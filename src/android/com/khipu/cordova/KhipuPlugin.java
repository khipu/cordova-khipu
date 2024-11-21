package com.khipu.cordova;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;

import static com.khipu.client.KhipuKt.KHIPU_RESULT_EXTRA;
import static com.khipu.client.KhipuKt.getKhipuLauncherIntent;

import android.app.Activity;
import android.content.Intent;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import com.khipu.client.KhipuColors;
import com.khipu.client.KhipuOptions;
import com.khipu.client.KhipuResult;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Objects;


public class KhipuPlugin extends CordovaPlugin {

    private ActivityResultLauncher<Intent> launcher;
    private CallbackContext callbackContext;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if ("startOperation".equals(action)) {
            this.callbackContext = callbackContext;
            JSONObject jsonObject = args.getJSONObject(0);
            this.startOperation(jsonObject);
            return true;
        }
        return false;
    }

    private void startOperation(JSONObject call) {
        String operationId = call.optString("operationId");
        if (operationId.isEmpty()) {
            callbackContext.error("Must provide operationId");
            return;
        }
        KhipuOptions.Builder optionsBuilder = new KhipuOptions.Builder();
        JSONObject options = call.optJSONObject("options");

        if (options != null) {
            if (options.has("title")) {
                optionsBuilder.topBarTitle(Objects.requireNonNull(options.optString("title")));
            }
            if (options.has("titleImageUrl")) {
                optionsBuilder.topBarImageUrl(Objects.requireNonNull(options.optString("titleImageUrl")));
            }
            if (options.has("skipExitPage")) {
                optionsBuilder.skipExitPage(Boolean.TRUE.equals(options.optBoolean("skipExitPage")));
            }
            if (options.has("showFooter")) {
                optionsBuilder.showFooter(Boolean.TRUE.equals(options.optBoolean("showFooter")));
            }
            if (options.has("showMerchantLogo")) {
                optionsBuilder.showMerchantLogo(Boolean.TRUE.equals(options.optBoolean("showMerchantLogo")));
            }
            if (options.has("showPaymentDetails")) {
                optionsBuilder.showPaymentDetails(Boolean.TRUE.equals(options.optBoolean("showPaymentDetails")));
            }
            if (options.has("locale")) {
                optionsBuilder.locale(Objects.requireNonNull(options.optString("locale")));
            }
            if (options.has("theme")) {
                String theme = options.optString("theme");
                switch (theme) {
                    case "light":
                        optionsBuilder.theme(KhipuOptions.Theme.LIGHT);
                        break;
                    case "dark":
                        optionsBuilder.theme(KhipuOptions.Theme.DARK);
                        break;
                    case "system":
                        optionsBuilder.theme(KhipuOptions.Theme.SYSTEM);
                        break;
                }
            }
            KhipuColors.Builder colorsBuilder = new KhipuColors.Builder();
            if (options.has("colors")) {
                JSONObject colors = options.optJSONObject("colors");
                if (colors != null) {
                    if (colors.has("lightBackground")) {
                        colorsBuilder.lightBackground(Objects.requireNonNull(colors.optString("lightBackground")));
                    }
                    if (colors.has("lightOnBackground")) {
                        colorsBuilder.lightOnBackground(Objects.requireNonNull(colors.optString("lightOnBackground")));
                    }
                    if (colors.has("lightPrimary")) {
                        colorsBuilder.lightPrimary(Objects.requireNonNull(colors.optString("lightPrimary")));
                    }
                    if (colors.has("lightOnPrimary")) {
                        colorsBuilder.lightOnPrimary(Objects.requireNonNull(colors.optString("lightOnPrimary")));
                    }
                    if (colors.has("lightTopBarContainer")) {
                        colorsBuilder.lightTopBarContainer(Objects.requireNonNull(colors.optString("lightTopBarContainer")));
                    }
                    if (colors.has("lightOnTopBarContainer")) {
                        colorsBuilder.lightOnTopBarContainer(Objects.requireNonNull(colors.optString("lightOnTopBarContainer")));
                    }
                    if (colors.has("darkBackground")) {
                        colorsBuilder.darkBackground(Objects.requireNonNull(colors.optString("darkBackground")));
                    }
                    if (colors.has("darkOnBackground")) {
                        colorsBuilder.darkOnBackground(Objects.requireNonNull(colors.optString("darkOnBackground")));
                    }
                    if (colors.has("darkPrimary")) {
                        colorsBuilder.darkPrimary(Objects.requireNonNull(colors.optString("darkPrimary")));
                    }
                    if (colors.has("darkOnPrimary")) {
                        colorsBuilder.darkOnPrimary(Objects.requireNonNull(colors.optString("darkOnPrimary")));
                    }
                    if (colors.has("darkTopBarContainer")) {
                        colorsBuilder.darkTopBarContainer(Objects.requireNonNull(colors.optString("darkTopBarContainer")));
                    }
                    if (colors.has("darkOnTopBarContainer")) {
                        colorsBuilder.darkOnTopBarContainer(Objects.requireNonNull(colors.optString("darkOnTopBarContainer")));
                    }
                }
            }
            optionsBuilder.colors(colorsBuilder.build());
        }
        cordova.getActivity().runOnUiThread(() -> launcher.launch(getKhipuLauncherIntent(cordova.getContext(), operationId, optionsBuilder.build())));
    }

    @Override
    public void pluginInitialize() {
        super.pluginInitialize();
        launcher = cordova.getActivity().getActivityResultRegistry().register(
                "cordova_khipu_plugin",
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        Intent data = result.getData();
                        if (data != null) {
                            KhipuResult khipuResult = (KhipuResult) Objects.requireNonNull(result.getData().getExtras()).getSerializable(KHIPU_RESULT_EXTRA);
                            assert khipuResult != null;
                            if ("ERROR".equals(khipuResult.getResult())) {
                                callbackContext.error(khipuResult.asJson());
                            } else {
                                callbackContext.success(khipuResult.asJson());
                            }
                        } else {
                            callbackContext.error("No data received");
                        }
                    } else {
                        callbackContext.error("Activity cancelled or failed");
                    }
                }
        );
    }

}
