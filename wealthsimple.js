require("dotenv").config();
const { auth, accounts, orders } = require("wstrade-api");

const DEBUG = process.env.DEBUG === "true";

exports.wsDrip = async (req, res) => {
  try {
    await wsAuth(req);

    const accountId = await getAccountId();
    const accountInfo = await getAccountInfo(accountId);
    const orderResults = await placeBuyOrders(accountId, accountInfo);

    res.send({ status: 200, orderResults });
  } catch (e) {
    res.send({ status: 500, error: e });
  }
};

async function wsAuth(req) {
  auth.on("otp", req.otpCallback);
  await auth.login(process.env.WS_EMAIL, process.env.WS_PASS);
}

async function getAccountId() {
  let accs = await accounts.all();
  return process.env.ACCOUNT_TYPE === "rrsp" ? accs.rrsp : accs.tfsa;
}

async function getAccountInfo(accountId) {
  const buyingPower = await getBuyingPower(accountId);
  const positions = await accounts.positions(accountId);
  const activities = await accounts.activities({
    type: ["dividend", "buy"],
    accounts: [accountId],
  });
  const dividends = getDividends(positions, activities);

  return { buyingPower, positions, activities, dividends };
}

async function getBuyingPower(accountId) {
  let accountList = await accounts.data();
  const accountData = accountList.find((acc) => acc.id === accountId);
  return accountData.buying_power.amount;
}

/*
 Find uninvested dividends since last completed buy order
*/
function getDividends(positions, activities) {
  const symbolsCounted = {};
  const dividendsBySymbol = positions.reduce((obj, pos) => {
    return {
      ...obj,
      [pos.stock.symbol]: 0,
    };
  }, {});

  let totalUninvested = 0;
  activities.every((a) => {
    if (symbolsCounted.length === positions.length) return false;

    if (!symbolsCounted[a.symbol]) {
      if (a.object === "order" && a.status === "posted") {
        symbolsCounted[a.symbol] = true;
      }
      if (a.object === "dividend") {
        totalUninvested += a.market_value.amount;
        dividendsBySymbol[a.symbol] += a.market_value.amount;
      }
    }
    return true;
  });

  return { totalUninvested, dividendsBySymbol };
}

async function placeBuyOrders(
  accountId,
  { buyingPower, positions, dividends }
) {
  const baseAmount = calculateBaseOrder(
    buyingPower,
    positions.length,
    dividends.totalUninvested
  );

  const results = [];
  for (const [symbol, dividendAmount] of Object.entries(
    dividends.dividendsBySymbol
  )) {
    const buyAmount = calculateBuyAmount(baseAmount, dividendAmount);
    const result = await placeBuyOrder(accountId, symbol, buyAmount);
    results.push({
      symbol,
      buyAmount,
      dividendAmount,
      result,
    });
  }

  return results;
}

async function placeBuyOrder(accountId, symbol, buyAmount) {
  if (DEBUG) {
    return {
      response: "debug mode"
    };
  }
  
  if (buyAmount < 1) {
    return {
      error: "fractional orders must be $1 or more in value",
    };
  }

  return await orders
    .fractionalBuy(accountId, symbol, buyAmount)
    .then((response) => {
      return { response };
    })
    .catch((error) => {
      return {  error  };;
    });
}

function calculateBaseOrder(buyingPower, numPositions, totalUninvested) {
  // adjust by 10^2 to avoid floating point shenanigans
  return (
    Math.floor((100 * buyingPower - 100 * totalUninvested) / numPositions) / 100
  );
}

function calculateBuyAmount(baseAmount, dividendAmount) {
  // adjust by 10^2 to avoid floating point shenanigans
  return Math.round((baseAmount + dividendAmount) * 100) / 100;
}
