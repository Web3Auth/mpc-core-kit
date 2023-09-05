# Web3Auth MPC Core Kit Beta

[![npm version](https://img.shields.io/npm/v/@web3auth/no-modal?label=%22%22)](https://www.npmjs.com/package/@web3auth/no-modal/v/latest)
[![minzip](https://img.shields.io/bundlephobia/minzip/@web3auth/no-modal?label=%22%22)](https://bundlephobia.com/result?p=@web3auth/no-modal@latest)

> Web3Auth is where passwordless auth meets non-custodial key infrastructure for Web3 apps and wallets. By aggregating OAuth (Google, Twitter, Discord) logins, different wallets and innovative Multi Party Computation (MPC) - Web3Auth provides a seamless login experience to every user on your application.

Web3Auth MPC Core Kit Beta is a wrapper SDK that gives you all the needed functionalities for implementing the Web3Auth MPC features, giving you the flexibility of implementing your own UI and UX flows end to end.

## 📖 Documentation

Checkout the official [Web3Auth Documentation](https://web3auth.io/docs/sdk/) to get started.

...and a lot more

## 🔗 Installation

```shell
npm install --save @web3auth/mpc-core-kit
```

## ⚡ Quick Start

### Get your Client ID from Web3Auth Dashboard

Hop on to the [Web3Auth Dashboard](https://dashboard.web3auth.io/) and create a new project. Use the Client ID of the project to start your integration.

![Web3Auth Dashboard](https://web3auth.io/docs/assets/images/project_plug_n_play-89c39ec42ad993107bb2485b1ce64b89.png)

### Initialize Web3Auth for your preferred blockchain

Web3Auth needs to initialise as soon as your app loads up to enable the user to log in. Preferably done within a constructor, initialisation is the step where you can pass on all the configurations for Web3Auth you want. A simple integration for Ethereum blockchain will look like this:

```js
import { Web3AuthMPCCoreKit } from "@web3auth/mpc-core-kit";

//Initialize within your constructor
const web3auth = new Web3AuthMPCCoreKit({
    web3AuthClientId: 'YOUR_CLIENT_ID',
    web3AuthNetwork: WEB3AUTH_NETWORK.DEVNET
});


await web3auth.init();
```

### Login your User

Once you're done initialising, just create a button that triggers login for your preferred social channel for the user on their request. You can further use the returned provider for making RPC calls to the blockchain.

```js
const web3authProvider = await web3auth.connect({ 
    subVerifierDetails: { 
        verifier: "torus-test-health",
        typeOfLogin: 'jwt',
        clientId: "torus-key-test",
        jwtParams: {
            verifierIdField: "email",
            id_token: token
        }
    }
})
```

## 🩹 Examples

Checkout the examples for your preferred blockchain and platform in our [examples repository](https://github.com/Web3Auth/web3auth-core-kit-examples)

## 🌐 Demo

Checkout the [Web3Auth Demo](https://demo-app.web3auth.io/) to see how Web3Auth can be used in your application.

## 💬 Troubleshooting and Support

- Have a look at our [Community Portal](https://community.web3auth.io/) to see if anyone has any questions or issues you might be having. Feel free to reate new topics and we'll help you out as soon as possible.
- Checkout our [Troubleshooting Documentation Page](https://web3auth.io/docs/troubleshooting) to know the common issues and solutions.
- For Priority Support, please have a look at our [Pricing Page](https://web3auth.io/pricing.html) for the plan that suits your needs.

## Development

```
npm i # install dependencies
npm run build # build package
npm run docs # build documentation
```
