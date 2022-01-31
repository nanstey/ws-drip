# Wealthsimple DRIP

A dividend reinvestment plan (DRIP) is a program that allows investors to reinvest their cash dividends into additional shares or fractional shares of the underlying stock on the dividend payment date. Since Wealthsimple doesn't provide this functionality automatically, the goal of this project is to automate the process.

## How it works
1. Authenticate with Wealthsimple using email, password, and OTP code
2. Pull account info:
   * Current buying power
   * Open positions
   * Dividends collected since last completed buy order
3. Place fractional buy orders for <i>every</i> open position
   * Determine a base dollar amount to buy for all positions based on the current buying power minus any dividends received since the last executed buy order 
   * Securities that have <i>not</i> paid dividends place buy orders of the base amount
   * Securities that have paid dividends place buy orders of the base amount plus dividends

## Requirements
1. Sign up with [Wealthsimple Trade](https://www.wealthsimple.com/en-ca/product/trade?keyword=wealthsimple%20trade)
   1. Either a TFSA or RRSP trading account
   2. All open positions should support [fractional orders](https://help.wealthsimple.com/hc/en-ca/articles/4413542937627) 
   3. Security settings must be configured to receive OTP codes by email
2. A [Google Workspace](https://workspace.google.com/) account
   1. Wealthsimple OTP code must be sent or forwarded to an email under your Google Workspace
   2. A [GCP service account](https://cloud.google.com/iam/docs/service-accounts) with [domain-wide delegation](https://developers.google.com/admin-sdk/directory/v1/guides/delegation)
   3. [Gmail API](https://console.cloud.google.com/marketplace/product/google/gmail.googleapis.com) is enabled for the current project in GCP


## Assumptions
1. Your Wealthsimple account receives deposits on a regular schedule
2. This script is run on a regular schedule
3. You want all deposited funds to be distributed evenly among your open postions
4. Buy orders are only executed by this script
   * Any manual buy orders may obscure previous unnacounted dividend payouts

## Getting Started
1. Fork and clone the repo
2. Create an API key for your service account. Download the JSON file to the project directory and name it `serviceAccount.json`
3. Rename `.env.yaml.example` to `.env.yaml` and fill out the environment variables for Gmail and Wealthsimple

## Running the script

Install dependencies:
```
npm install
```

Start the cloud function:
```
npm start
```
```
> ws-drip@1.0.0 start
> functions-framework --target=wsDrip

Serving function...
Function: wsDrip
Signature type: http
URL: http://localhost:8080/

```

Use a browser or API client to `GET` or `POST` to [http://localhost:8080/](http://localhost:8080/)

It will take at least 15 seconds to execute. There is a 10 second setTimeout during authentication to give Gmail enough time to receive the OTP code.

Sample response:
```
{
  "status": 200,
  "orderResults": [
    {
      "symbol": "BCE",
      "buyAmount": 37.35,
      "dividendAmount": 0.68,
      "result": {
        "response": "debug mode",
        "error": null
      }
    },
    {
      "symbol": "BEPC",
      "buyAmount": 37.06,
      "dividendAmount": 0.39,
      "result": {
        "response": "debug mode",
        "error": null
      }
    },
    {
      "symbol": "BIPC",
      "buyAmount": 36.67,
      "dividendAmount": 0,
      "result": {
        "response": "debug mode",
        "error": null
      }
    },
    ...
    ...
    ...
    {
      "symbol": "TD",
      "buyAmount": 36.67,
      "dividendAmount": 0,
      "result": {
        "response": "debug mode",
        "error": null
      }
    }
  ]
}

```

`result.response` will return the API response from Wealthsimple

`result.error` will contain any errors thrown by [wstrade-api](https://github.com/ahmedsakr/wstrade-api)

## Deployment

Initialize [Google Cloud SDK](https://cloud.google.com/sdk/docs/initializing)

See the Node.js Cloud Functions [Quickstart Guide](https://cloud.google.com/functions/docs/quickstart-nodejs)

See the [Deploying from Your Local Machine](https://cloud.google.com/functions/docs/deploying/filesystem)

Authenticate with gcloud

```
gcloud auth login
```

Deploy the cloud function to your GCP project
```
gcloud functions deploy wsDrip --project=${PROJECT_ID}--runtime nodejs16 --trigger-http --allow-unauthenticated --env-vars-file=.env.yaml
```

Configure [Google Cloud Scheduler](https://cloud.google.com/scheduler/docs/quickstart) to trigger the function periodically.