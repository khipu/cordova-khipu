# cordova-khipu

Cordova plugin for Khipu


## iOS pre setup


The default deployment target of a cordova app is 11, which is too low for Khipu, please set the ios deployment target to, at least, 12.

In order to do that make sure the `config.xml` of your app to have a `platform` section for `ios` with the desired `deployment-target`.

```xml
    <platform name="ios">
        <preference name="deployment-target" value="12.0" />
    </platform>
```

## Install

```bash
cordova plugin add cordova-khipu
```

## iOS setup

No need for aditional steps

## Android setup

No need for aditional steps

## Usage

The `cordova-khipu` plugin makes the `Khipu.startOperation` method available in the `window` object.

The first parameter is the `operationId` of the payment to authorize with all the options (datailed in the example).

The second parameter is a callback funcion that will be invoked if the authorization process completed and the third if it failed.


```javascript

  window.Khipu.startOperation({
          operationId: '<paymentId>',
          options: {
              title: '<Title to display in the payment process>', // Title for the top bar during the payment process.
              titleImageUrl: '<Image to display centered in the topbar>', // Url of the image to display in the top bar.
              locale: 'es_CL', // Regional settings for the interface language. The standard format combines an ISO 639-1 language code and an ISO 3166 country code. For example, "es_CL" for Spanish (Chile).
              theme: 'light', // The theme of the interface, can be 'dark', 'light' or 'system'
              showFooter: true, // If true, a message is displayed at the bottom with the Khipu logo.
              showMerchantLogo: true, // If true, the merchant's logo is displayed in the top bar.
              showPaymentDetails: true, // If true, the payment code and a link to view the details are displayed.
              skipExitPage: false, // If true, skips the exit page at the end of the payment process, whether successful or failed.
              colors: {
                  lightTopBarContainer: '<colorHex>', // Optional background color for the top bar in light mode.
                  lightOnTopBarContainer: '<colorHex>', // Optional color of the elements on the top bar in light mode.
                  lightPrimary: '<colorHex>', // Optional primary color in light mode.
                  lightOnPrimary: '<colorHex>', // Optional color of elements on the primary color in light mode.
                  lightBackground: '<colorHex>', // Optional general background color in light mode.
                  lightOnBackground: '<colorHex>', // Optional color of elements on the general background in light mode.
                  darkTopBarContainer: '<colorHex>', // Optional background color for the top bar in dark mode.
                  darkOnTopBarContainer: '<colorHex>', // Optional color of the elements on the top bar in dark mode.
                  darkPrimary: '<colorHex>', // Optional primary color in dark mode.
                  darkOnPrimary: '<colorHex>', // Optional color of elements on the primary color in dark mode.
                  darkBackground: '<colorHex>', // Optional general background color in dark mode.
                  darkOnBackground: '<colorHex>', // Optional color of elements on the general background in dark mode.
              }
          }
      },
      (success) => {
        console.log(JSON.stringify(success))
      },
      (error) => {
        console.error(JSON.stringify(error))
      }
  )
```

The `data` and `error` object passed to the callback functions are of the type `KhipuResult`

#### KhipuResult

| Prop                | Type                                                    |
| ------------------- | ------------------------------------------------------- |
| **`operationId`**   | <code>string</code>                                     |
| **`exitTitle`**     | <code>string</code>                                     |
| **`exitMessage`**   | <code>string</code>                                     |
| **`exitUrl`**       | <code>string</code>                                     |
| **`result`**        | <code>'OK' \| 'ERROR' \| 'WARNING' \| 'CONTINUE'</code> |
| **`failureReason`** | <code>string</code>                                     |
| **`continueUrl`**   | <code>string</code>                                     |
| **`events`**        | <code>KhipuEvent[]</code>                               |


#### KhipuEvent

| Prop            | Type                |
| --------------- | ------------------- |
| **`name`**      | <code>string</code> |
| **`timestamp`** | <code>string</code> |
| **`type`**      | <code>string</code> |
