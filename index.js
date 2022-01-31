const { wsDrip } = require("./wealthsimple");
const { getCodeFromGmail } = require("./gmail");

exports.wsDrip = async (req, res) => {
  return await wsDrip({ otpCallback: getCodeFromGmail }, res);
};
