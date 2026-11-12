package app.bobine.tv;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.app.UiModeManager;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;

/**
 * Appli Android TV : affiche l'interface web en plein écran et lui donne
 * la touche Retour, le micro de la télécommande et un accès à Seerr sans blocage CORS.
 */
public class MainActivity extends Activity {
    private static final int VOICE = 42;
    // servie en http : sinon les vieux moteurs web « remontent » en https les images et vidéos
    // d'un serveur maison en http (contenu mixte), et elles ne s'affichent jamais
    private static final String LOCAL = "http://appassets.androidplatform.net/assets/www/index.html";
    private WebView web;
    private WebViewAssetLoader assets;
    private SharedPreferences prefs;
    private boolean failed = false;

    private boolean isTv() {
        UiModeManager m = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        return m != null && m.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    private String startUrl() {
        return BuildConfig.APP_URL.isEmpty() ? LOCAL : BuildConfig.APP_URL;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("app", MODE_PRIVATE);
        assets = new WebViewAssetLoader.Builder().setHttpAllowed(true).addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#05070B"));
        setContentView(web);
        hideBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // au cas où l'interface serait servie en https (APP_URL) et le serveur en http
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " BobineApp/" + BuildConfig.VERSION_NAME);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.addJavascriptInterface(new Bridge(), "AppNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return assets.shouldInterceptRequest(req.getUrl());
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) {
                    v.loadData("<html><body style='background:#05070B;color:#F2F4F8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center'>"
                        + "<div><h1>Page injoignable</h1><p>Vérifie la connexion réseau.</p><p>Appuie sur OK pour réessayer.</p></div></body></html>", "text/html; charset=utf-8", "UTF-8");
                    failed = true;
                }
            }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(startUrl());
        web.requestFocus();
    }

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) hideBars(); }
    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
    @Override protected void onPause() { super.onPause(); web.evaluateJavascript("document.querySelectorAll('video').forEach(v=>v.pause())", null); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (failed && e.getAction() == KeyEvent.ACTION_UP && (e.getKeyCode() == KeyEvent.KEYCODE_DPAD_CENTER || e.getKeyCode() == KeyEvent.KEYCODE_ENTER)) {
            failed = false; web.loadUrl(startUrl()); return true;
        }
        // Retour : l'interface décide (fermer un menu, revenir en arrière, ou quitter)
        if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_UP) {
                if (failed) finish();
                else web.evaluateJavascript("window.appBack ? (window.appBack(), 'ok') : 'none'", r -> { if (r == null || r.contains("none")) finish(); });
            }
            return true;
        }
        if (e.getKeyCode() == KeyEvent.KEYCODE_SEARCH || e.getKeyCode() == KeyEvent.KEYCODE_VOICE_ASSIST) {
            if (e.getAction() == KeyEvent.ACTION_UP) web.evaluateJavascript("window.appVoiceKey && window.appVoiceKey()", null);
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != VOICE) return;
        String text = "";
        if (res == RESULT_OK && data != null) {
            ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (r != null && !r.isEmpty()) text = r.get(0);
        }
        web.evaluateJavascript("window.onAppVoice && window.onAppVoice(" + JSONObject.quote(text) + ")", null);
    }

    /** Requête HTTP faite par l'appli (pour Seerr), avec son cookie de session gardé entre deux lancements. */
    private void httpRequest(String id, String method, String url, String body) {
        int status = 0; String text = "";
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setRequestMethod(method);
            c.setConnectTimeout(10000); c.setReadTimeout(20000);
            c.setRequestProperty("Accept", "application/json");
            String host = Uri.parse(url).getHost();
            String cookie = prefs.getString("cookie:" + host, null);
            if (cookie != null) c.setRequestProperty("Cookie", cookie);
            if (body != null && !body.isEmpty()) {
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                try (OutputStream o = c.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
            }
            status = c.getResponseCode();
            Map<String, List<String>> h = c.getHeaderFields();
            List<String> set = h.get("Set-Cookie");
            if (set != null && !set.isEmpty()) {
                StringBuilder sb = new StringBuilder();
                for (String sc : set) { if (sb.length() > 0) sb.append("; "); sb.append(sc.split(";", 2)[0]); }
                prefs.edit().putString("cookie:" + host, sb.toString()).apply();
            }
            InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in != null) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192]; int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                text = out.toString("UTF-8");
            }
        } catch (Exception ex) { status = 0; text = "{\"message\":\"Seerr injoignable\"}"; }
        final String js = "window.__nativeResp(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(text) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    class Bridge {
        @JavascriptInterface public void startVoice() {
            runOnUiThread(() -> {
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "fr-FR");
                i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Qu'est-ce qu'on regarde ?");
                try { startActivityForResult(i, VOICE); }
                catch (ActivityNotFoundException ex) {
                    Toast.makeText(MainActivity.this, "Recherche vocale indisponible sur cet appareil", Toast.LENGTH_LONG).show();
                    web.evaluateJavascript("window.onAppVoice && window.onAppVoice('')", null);
                }
            });
        }
        @JavascriptInterface public void request(String id, String method, String url, String body) {
            new Thread(() -> httpRequest(id, method, url, body)).start();
        }
        @JavascriptInterface public void exit() { runOnUiThread(MainActivity.this::finish); }
        @JavascriptInterface public String platform() { return isTv() ? "android-tv" : "android"; }
        /** téléphone : paysage forcé pendant la lecture, libre sinon */
        @JavascriptInterface public void setLandscape(boolean on) {
            if (isTv()) return;
            runOnUiThread(() -> setRequestedOrientation(on ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED));
        }
        @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }
    }
}
