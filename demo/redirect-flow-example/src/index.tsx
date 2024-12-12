import "./index.css";
import "../global.css";

import ReactDOM from "react-dom/client";
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

import App from "./App";
import React from "react";
import { CoreKitProvider } from "./composibles/useCoreKit";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RecoveryOptionsCard } from "./components/mfa-cards/recovery/RecoveryOptionCard";
import { VerifyMnemonicPhraseCard } from "./components/mfa-cards/mnemonic/VerifyMnemonic";
import { VerifyAuthenticatorCodeCard } from "./components/mfa-cards/authenticator/AuthenticatorVerify";
import { ConfirmPasswordCard } from "./components/mfa-cards/password/ConfirmPassword";
import { Header } from "./components/NavBar";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <CoreKitProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/recovery" element={<RecoveryOptionsCard />} />
          <Route path="/verify-phrase" element={<VerifyMnemonicPhraseCard />} />
          <Route path="/verify-authenticator" element={<VerifyAuthenticatorCodeCard />} />
          <Route path="/verify-password" element={<ConfirmPasswordCard />} />
        </Routes>
      </BrowserRouter>
    </CoreKitProvider>
  </React.StrictMode>
);


// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();
