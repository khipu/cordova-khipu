package com.khipu.cordova;

import static com.khipu.client.KhipuKt.KHIPU_RESULT_EXTRA;
import static com.khipu.client.KhipuKt.getKhipuLauncherIntent;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import com.khipu.client.KhipuOptions;
import com.khipu.client.KhipuResult;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicReference;

public class KhipuPlugin extends CordovaPlugin {

    private static final String TAG = "KhipuPlugin";

    private ActivityResultLauncher<Intent> launcher;

    /**
     * The call waiting for a result, or null when no operation is in flight.
     *
     * Atomic, and claimed on the calling thread, for a reason that is easy to miss: the
     * launch below happens inside runOnUiThread, so execute() returns before it runs. A
     * guard written as an assignment inside that block would let two calls in quick
     * succession both pass it, and the first callback would be lost. compareAndSet on
     * the caller's thread is what makes "one operation at a time" true.
     */
    private final AtomicReference<CallbackContext> pendingCall = new AtomicReference<>();

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) {
        if (!"startOperation".equals(action)) {
            return false;
        }
        startOperation(args, callbackContext);
        return true;
    }

    /**
     * Everything that can fail happens before the call is stored, and the store is the
     * last thing before the launch. The old order was the other way round — the callback
     * was kept first and the arguments read afterwards — which left a stored callback
     * that nobody would ever answer if anything in between went wrong. With a
     * one-at-a-time guard in place that is worse than a lost payment: it is a plugin
     * that rejects every operation from then on.
     */
    private void startOperation(JSONArray args, CallbackContext callbackContext) {
        Object first = args.opt(0);
        if (!(first instanceof JSONObject)) {
            callbackContext.error("startOperation expects an object as its first argument.");
            return;
        }

        JSONObject call = (JSONObject) first;
        Object operationId = call.opt("operationId");
        if (!(operationId instanceof String) || ((String) operationId).isEmpty()) {
            callbackContext.error("operationId must be provided and must be a string.");
            return;
        }

        final KhipuOptions options;
        try {
            options = KhipuOptionsMapper.makeOptions(KhipuOptionsMapper.parse(call));
        } catch (RuntimeException error) {
            callbackContext.error("Could not read the options: " + error);
            return;
        }

        // Checked before the slot is claimed, not after. A check that fails by doing
        // nothing is worse than one that throws: if the slot were already claimed and
        // the launch turned out to be impossible, nobody would answer.
        Activity activity = cordova.getActivity();
        if (activity == null || launcher == null) {
            callbackContext.error("No activity available to start the operation from.");
            return;
        }

        if (!pendingCall.compareAndSet(null, callbackContext)) {
            callbackContext.error("A Khipu operation is already in progress.");
            return;
        }

        final String id = (String) operationId;
        activity.runOnUiThread(() -> {
            // The try has to be here and not around execute(): this block runs later, on
            // the UI thread, so an exception raised in it would not pass through any
            // caller's catch — it would reach the thread's default handler and take the
            // app with it. The class of failure matters more than any particular
            // exception: if the activity never starts, no result will ever arrive, and
            // that is exactly the condition that hangs a callback forever.
            try {
                launcher.launch(getKhipuLauncherIntent(cordova.getContext(), id, options));
            } catch (RuntimeException error) {
                CallbackContext pending = pendingCall.getAndSet(null);
                if (pending != null) {
                    pending.error("Could not start the Khipu operation: " + error);
                }
            }
        });
    }

    @Override
    public void pluginInitialize() {
        super.pluginInitialize();
        launcher = cordova.getActivity().getActivityResultRegistry().register(
                "cordova_khipu_plugin",
                new ActivityResultContracts.StartActivityForResult(),
                this::deliver
        );
    }

    /**
     * Answers the pending call, and never throws.
     *
     * What decides the outcome is the payload, not the result code. The SDK has exactly
     * two exits and both carry a complete KhipuResult: the ordinary one, and an abort in
     * onCreate when the activity was destroyed for more than three minutes and the user
     * came back, which reports USER_CANCELED. Branching on the code would mean the same
     * outcome for the merchant — the user walked away — arrived in two different shapes
     * depending on whether Android killed the activity, which is an invisible timing
     * detail deciding the response format. Verified in KhipuActivity.kt:119 and :320 at
     * tag 2.28.3.
     */
    private void deliver(ActivityResult activityResult) {
        CallbackContext callbackContext = pendingCall.getAndSet(null);

        if (callbackContext == null) {
            // Reached when the host activity was destroyed during the operation: Cordova
            // rebuilt the plugin and the new instance has no callbackId, so there is
            // nobody to answer. Logging and dropping is all that is left — the previous
            // code raised an NPE here and took the app down. The README tells merchants
            // to confirm the operation's status server-side for this reason.
            Log.w(TAG, "A Khipu result arrived with no pending call; the host activity was "
                    + "probably recreated during the operation.");
            return;
        }

        try {
            KhipuResult result = extractResult(activityResult.getData());
            if (result == null) {
                callbackContext.error("The Khipu operation returned no result.");
                return;
            }

            JSONObject json = KhipuResultMapper.toJson(result);
            if (KhipuResultMapper.isError(result)) {
                callbackContext.error(json);
            } else {
                callbackContext.success(json);
            }
        } catch (Exception error) {
            callbackContext.error("Could not read the Khipu result: " + error);
        }
    }

    private static KhipuResult extractResult(Intent data) {
        if (data == null) {
            return null;
        }
        // The untyped getSerializableExtra is deprecated from API 33, but its typed
        // replacement does not exist below it and this plugin supports minSdk 24. The
        // instanceof is what the old code tried to get from `assert`, which ART ignores
        // unless assertions are explicitly enabled — so the NPE it pretended to guard
        // arrived one line later anyway.
        Object extra = data.getSerializableExtra(KHIPU_RESULT_EXTRA);
        return extra instanceof KhipuResult ? (KhipuResult) extra : null;
    }
}
