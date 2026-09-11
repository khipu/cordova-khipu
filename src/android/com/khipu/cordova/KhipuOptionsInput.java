package com.khipu.cordova;

import com.khipu.client.KhipuOptions;

import java.util.Map;
import java.util.Objects;

/**
 * Typed representation of the options that arrived from JavaScript.
 *
 * It exists apart from KhipuOptions for the same two reasons as its Swift counterpart.
 * The practical one: a test cannot read back what it put into the SDK's builder. The
 * design one: it separates what can fail — interpreting a dictionary a third party
 * built — from what cannot, which is applying already-validated values.
 *
 * A null field means "the JavaScript did not send this key", which is not the same as
 * sending it as false: the SDK applies its own defaults and the plugin has to let it.
 * That is why the booleans are boxed.
 */
final class KhipuOptionsInput {

    String topBarTitle;
    String topBarImageUrl;
    Boolean skipExitPage;
    Boolean skipExitSuccessPage;
    Boolean showFooter;
    Boolean showMerchantLogo;
    Boolean showPaymentDetails;
    String locale;
    KhipuOptions.Theme theme;
    /** Null means the `colors` key was absent; empty means it arrived with nothing usable. */
    Map<String, String> colors;

    // Value semantics, so a test can compare a whole input against an empty one the way
    // the Swift suite does with its Equatable struct.
    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof KhipuOptionsInput)) {
            return false;
        }
        KhipuOptionsInput that = (KhipuOptionsInput) other;
        return Objects.equals(topBarTitle, that.topBarTitle)
                && Objects.equals(topBarImageUrl, that.topBarImageUrl)
                && Objects.equals(skipExitPage, that.skipExitPage)
                && Objects.equals(skipExitSuccessPage, that.skipExitSuccessPage)
                && Objects.equals(showFooter, that.showFooter)
                && Objects.equals(showMerchantLogo, that.showMerchantLogo)
                && Objects.equals(showPaymentDetails, that.showPaymentDetails)
                && Objects.equals(locale, that.locale)
                && Objects.equals(theme, that.theme)
                && Objects.equals(colors, that.colors);
    }

    @Override
    public int hashCode() {
        return Objects.hash(topBarTitle, topBarImageUrl, skipExitPage, skipExitSuccessPage,
                showFooter, showMerchantLogo, showPaymentDetails, locale, theme, colors);
    }
}
