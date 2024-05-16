## Example App
To run the demo, under this directory
-  `npm install`
-  `npm start`

## Glossaries
<u>**Export TSS Key**</u>
- Exporting `TSS Key` reconstructs the original key. 

<u>**Import TSS Key**</u>
- Import the exported TSS Key from one account to another.

<u>**Recover TSS Key**</u>
- Recover your TSS Key with the `device` & `recovery` factors which you got from enabling MFA.

>_Note: **recover** and **export** TSS Key reset the account. (i.e: the new account has different factors and shares but will have the same public address)_

----
### To test on `export/import` and `recover/import` functions, you can do the followings in the demo -

#### Export/Import
- when you're logged in, click on the `Export/Import Key` button, this will first reconstructs and exports your `TSS Key` 
- After successful export, you will be logged out and asked to enter the account name/email which you will import the **exported TSS Key**
- then you will be logged in with the new account/email and **exported Key** 

#### Recover/Import
- as a prerequisite, your account need to be **MFA enabled** and have access to **Factor Keys**(Device and Recovery), in order to do the TSS Key recovery
- at the login screen, enter your factor keys (`Device` and `Recovery`) which you got from enabling MFA and click on `Recover with Factor Keys` button
- the above step will reconstruct the **TSS Key** using your factor keys (device & recovery) and export **TSS Key**
- then, you will be asked to enter the new email address which will be used to associate to your **exported Key**
- after successful import, you will be logged in with different user/email

#### Verification
- to verify the above features, you can click on `Get User Info` button or `Get Accounts` button (under the Blockchain Calls section)
- The expected result is`your email address changees` but `the account is remaining the same`

#### How to enable MFA
1. log in
2. click `Enable MFA`
3. then you can export your `device` and `recovery` shares which you can use to login or recover your account

> Note: when `manualSync` is true, (which you can specify during Corekit instantiation ) you will need to commit your changes before/after enabling MFA (Step-2).
----