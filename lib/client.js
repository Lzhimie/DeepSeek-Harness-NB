/**
 * dsh-community-plugins — browser half (hand-bundled for the DSH client
 * module system). Registers a `sidebar.footer.action` entry that opens the
 * community plugin center: browse the GitHub dsh-plugin topic (mirror-aware,
 * served by the host /community API) and install/uninstall with one click.
 */
window.__ModuleLoader__.load({
  id: "dsh-community-plugins",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { jsx, jsxs, Fragment } = require("react/jsx-runtime");

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */
    const cssText = [
      ".dsc-btn{font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 12px;font-size:12px;line-height:20px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}",
      ".dsc-btn:hover:not(:disabled){background:var(--dsw-alias-button-floating-hover)}",
      ".dsc-btn:disabled{opacity:.55;cursor:default}",
      ".dsc-btnPrimary{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:#fff}",
      ".dsc-btnDanger{border-color:color-mix(in srgb,var(--dsw-alias-label-error) 40%,transparent);color:var(--dsw-alias-label-error)}",
      ".dsc-footerButton{display:flex;align-items:center;gap:8px;width:100%;min-width:0;box-sizing:border-box;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;line-height:20px}",
      ".dsc-footerButton:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
      ".dsc-footerButtonIcon{justify-content:center;width:36px;height:36px;padding:0}",
      ".dsc-footerLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dsc-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9990}",
      // Popover surfaces (composer command menu, permission/model pickers,
      // workspace list portal, shell overlays like settings, and our own
      // drawers) share one background recipe driven by the popBg skin
      // settings: opaque by default so overlays stay readable even when the
      // main skin transparency is 0. ::before carries the grain texture.
      // The variable restoration makes every inner panel (they read the
      // --dsw-alias-bg-* tokens) opaque again instead of inheriting the
      // main skin's fully-transparent tint.
      "[class*='overlay'],[class*='_portal_'],[class*='_list_'],[class*='_menu'],[class*='VBkzZa_menu'],html[data-dsh-taskboard-active]{--dsw-alias-bg-base:rgba(18,18,20,var(--dsc-pop-alpha,1))!important;--dsw-alias-bg-layer-1:rgba(24,24,27,var(--dsc-pop-alpha,1))!important;--dsw-alias-bg-layer-2:rgba(30,30,34,var(--dsc-pop-alpha,1))!important;--dsw-alias-bg-layer-3:rgba(36,36,40,var(--dsc-pop-alpha,1))!important;--dsw-specific-sidebar-fill:rgba(22,22,24,var(--dsc-pop-alpha,1))!important;--dsw-alias-bg-module-platform:rgba(40,40,44,var(--dsc-pop-alpha,1))!important}",
      ".I_ks9a_menu,.dsc-drawer,[data-shell-overlay='true'] [data-slot]>*,[class*='_portal_'],[class*='_list_'],[class*='_menu'],[class*='VBkzZa_menu']{background-color:rgba(36,36,40,var(--dsc-pop-alpha,1)) !important;backdrop-filter:blur(var(--dsc-pop-blur,0px)) !important}",
      ".I_ks9a_menu::before,.dsc-drawer::before,[data-shell-overlay='true'] [data-slot]>*::before,[class*='_portal_']::before,[class*='_list_']::before,[class*='_menu']::before,[class*='VBkzZa_menu']::before{content:\"\";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;opacity:var(--dsc-pop-grain,0);background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")}",
      ".dsc-drawer{position:fixed;top:0;right:0;bottom:0;width:min(480px,100vw);background:var(--dsw-alias-bg-layer-3,var(--dsw-specific-sidebar-fill,#1c1c1e));color:var(--dsw-alias-label-primary);z-index:9991;display:flex;flex-direction:column;box-shadow:-12px 0 32px rgba(0,0,0,.3);font-size:13px;line-height:1.5}",
      ".dsc-head{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}",
      ".dsc-title{font-size:15px;font-weight:600;flex:1;min-width:0}",
      ".dsc-close{font:inherit;cursor:pointer;border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:18px;line-height:1;padding:4px 8px;border-radius:6px}",
      ".dsc-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
      ".dsc-toolbar{display:flex;gap:8px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;flex-wrap:wrap;align-items:center}",
      ".dsc-search{flex:1;min-width:140px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font:inherit;font-size:12px;line-height:18px}",
      ".dsc-search:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}",
      ".dsc-chip{font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:999px;padding:3px 10px;font-size:11px;line-height:16px}",
      ".dsc-chipOn{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}",
      ".dsc-sourceSelect{font:inherit;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:3px 8px;font-size:12px;line-height:20px;cursor:pointer;max-width:200px}",
      ".dsc-sourceSelect:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}",
      ".dsc-sourceWrap{position:relative;flex:none}",
      ".dsc-sourceBtn{min-width:150px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      // Custom source dropdown: the native <select> popup is OS-rendered
      // (white on white under some themes), so render our own list and let
      // it ride the popBg skin settings like every other popover.
      ".dsc-sourceList{position:absolute;top:calc(100% + 4px);left:0;z-index:1200;min-width:220px;max-height:260px;overflow:auto;background-color:rgba(36,36,40,var(--dsc-pop-alpha,1));backdrop-filter:blur(var(--dsc-pop-blur,0px));border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.35)}",
      ".dsc-sourceList::before{content:\"\";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;opacity:var(--dsc-pop-grain,0);background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")}",
      ".dsc-sourceItem{display:block;width:100%;text-align:left;font:inherit;font-size:12px;padding:6px 8px;border:none;background:transparent;color:var(--dsw-alias-label-primary);border-radius:6px;cursor:pointer}",
      ".dsc-sourceItem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}",
      ".dsc-body{flex:1;overflow-y:auto;padding:8px 12px 16px;min-height:0}",
      ".dsc-status{padding:8px 4px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
      ".dsc-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;margin:8px 0}",
      ".dsc-cardHead{display:flex;align-items:center;gap:8px;min-width:0}",
      ".dsc-cardName{font-weight:600;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}",
      ".dsc-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}",
      ".dsc-badgeInstalled{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 22%,transparent);color:var(--dsw-alias-state-business-primary)}",
      ".dsc-cardDesc{color:var(--dsw-alias-label-secondary);margin:6px 0 0;font-size:12px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
      ".dsc-cardMeta{display:flex;align-items:center;gap:10px;margin-top:8px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;flex-wrap:wrap}",
      ".dsc-cardActions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}",
      ".dsc-empty{padding:28px 12px;text-align:center;color:var(--dsw-alias-label-tertiary)}",
      ".dsc-moreRow{padding:10px 0 4px;text-align:center}",
      ".dsc-error{padding:16px 12px;color:var(--dsw-alias-label-error);text-align:center}",
      ".dsc-notice{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 12px;margin:8px 4px 0;font-size:12px;line-height:18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}",
      ".dsc-foot{padding:10px 16px;border-top:1px solid var(--dsw-alias-border-l2);flex:none;display:flex;gap:10px;align-items:center;justify-content:space-between;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
      ".dsc-dirRow{display:flex;align-items:center;gap:6px;min-width:0;flex:1}",
      ".dsc-dirPath{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}",
      ".dsc-dirInput{flex:1;min-width:120px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 8px;font:inherit;font-size:12px}",
      ".dsc-group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;margin:8px 0}",
      ".dsc-groupTitle{font-size:12px;font-weight:600;margin:0 0 8px;color:var(--dsw-alias-label-secondary)}",
      ".dsc-row{display:flex;align-items:center;gap:8px;margin:6px 0;min-width:0}",
      ".dsc-rowLabel{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);min-width:56px}",
      ".dsc-textInput{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 8px;font:inherit;font-size:12px}",
      ".dsc-range{flex:1;min-width:0;accent-color:var(--dsw-alias-state-business-primary)}",
      ".dsc-rangeVal{flex:none;width:38px;text-align:right;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
      ".dsc-colorInput{flex:none;width:40px;height:28px;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-3);cursor:pointer}",
      ".dsc-check{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer}",
      ".dsc-fileInput{display:none}",
      ".dsc-skinRow{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l2);min-width:0}",
      // Chat-input background: ::before carries the image (so blur/opacity/
      // position/scale hit the image only), ::after is the gradient fade
      // overlay. No overflow:hidden here: it would clip the composer's own
      // popovers (the "+" menu opens upward, outside the card). The image
      // never escapes the card anyway — background paints inside the element
      // and the scale slider resizes background-size instead of transforming
      // the layer; only cross mode intentionally grows past the card.
      // AI reply text color: the markdown body and its inner text elements
      // carry their own theme color, so the override must reach inside the
      // body with !important. An empty --dsc-chat-color falls back to the
      // theme default via inherit.
      "[class*='kBm9Yq_body'],[class*='kBm9Yq_body'] *{color:var(--dsc-chat-color,inherit) !important}",
      // My sent messages: user bubble background and its text color. The
      // background alpha comes from the opacity slider (hex color or the
      // theme's default 44,44,46 base), and the blur gives it the same
      // frosted-glass treatment as the input card.
      "[class*='P5DUYG_bubble']{background-color:var(--dsc-inputbox-bg-rgba,rgba(44,44,46,1)) !important;color:var(--dsc-inputbox-text,inherit) !important;backdrop-filter:blur(var(--dsc-inputbox-blur,0px)) !important}",
      "[class*='P5DUYG_bubble'] *{color:var(--dsc-inputbox-text,inherit) !important}",
      // The better-sidebar toggle cluster sits fixed at the very top-right,
      // right under the window's own minimize/maximize/close controls. Drop
      // it below the caption-button band, and push the whole panel content
      // (tab bar with its close/add-tab buttons + the explorer header with
      // the refresh button) down by the same offset so nothing overlaps the
      // window controls or the toggle cluster.
      "[class*='W-zNGW_toggleCluster']{top:44px !important}",
      "[class~='W-zNGW_pane']{padding-top:44px !important}",
      ".dsc-input-bg{position:relative !important}",
      // One single image: size/repeat/position follow the chosen mode
      // (fill/fit/stretch/tile/center/cross) via CSS variables; the image
      // layer stays inside the card except in cross mode, where it spans
      // past the input area (the layer grows to 220% and the full image
      // shows centred on it).
      ".dsc-input-bg::before{content:\"\";position:absolute;inset:var(--dsc-input-inset,0);background-image:var(--dsc-input-img);background-size:var(--dsc-input-size,cover);background-repeat:var(--dsc-input-repeat,no-repeat);background-position:var(--dsc-input-pos,50% 50%);filter:blur(var(--dsc-input-blur,0px));opacity:var(--dsc-input-opacity,1);transform:scale(var(--dsc-input-scale,1));z-index:0;pointer-events:none;border-radius:inherit;mask-image:var(--dsc-input-mask,none);-webkit-mask-image:var(--dsc-input-mask,none)}",
      ".dsc-input-bg.dsc-cross{overflow:visible !important}",
      ".dsc-input-bg.dsc-cross::before{inset:-60%}",
      ".dsc-input-bg::after{content:\"\";position:absolute;inset:0;background-image:var(--dsc-input-grad);z-index:1;pointer-events:none;border-radius:inherit}",
      ".dsc-input-bg>*{position:relative;z-index:2}",
      ".dsc-inputCard{position:relative !important;background-color:rgba(44,44,46,var(--dsc-input-bg-alpha,1)) !important;backdrop-filter:blur(10px) !important}",
      ".dsc-skinRow:last-child{border-bottom:none}",
      ".dsc-skinName{font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dsc-skinSpacer{flex:1}",
      ".dsc-hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin:4px 0 6px}",
      // Small-window adaptation: the app frame's sidebar column is fixed at
      // 280px, which would crush the conversation area on tiny windows.
      // Narrow it progressively as the window shrinks; a manually collapsed
      // sidebar (56px rail, .zVCCkW_collapsed) is left untouched.
      "@media (max-width:900px){div[style*=grid-template-columns]:not(:has(.zVCCkW_collapsed)){grid-template-columns:220px minmax(0,1fr) 0px !important}}",
      "@media (max-width:720px){div[style*=grid-template-columns]:not(:has(.zVCCkW_collapsed)){grid-template-columns:180px minmax(0,1fr) 0px !important}}",
      "@media (max-width:560px){div[style*=grid-template-columns]:not(:has(.zVCCkW_collapsed)){grid-template-columns:140px minmax(0,1fr) 0px !important}}",
      ".dsc-switch{position:relative;display:inline-block;width:34px;height:20px;flex:none;cursor:pointer}",
      ".dsc-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}",
      ".dsc-switchTrack{position:absolute;inset:0;border-radius:999px;background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);transition:background .15s ease}",
      ".dsc-switchThumb{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s ease}",
      ".dsc-switch input:checked + .dsc-switchTrack{background:var(--dsw-alias-state-business-primary);border-color:transparent}",
      ".dsc-switch input:checked + .dsc-switchTrack .dsc-switchThumb{transform:translateX(14px);background:#fff}",
      ".dsc-bgPreview{width:100%;height:64px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden;position:relative;cursor:grab;background:rgba(0,0,0,.35);margin:6px 0;touch-action:none}",
      ".dsc-bgPreview:active{cursor:grabbing}",
      ".dsc-bgPreviewImg{position:absolute;inset:0;background-repeat:no-repeat;background-size:cover}",
      ".dsc-link{color:var(--dsw-alias-label-secondary);text-decoration:none}",
      ".dsc-link:hover{color:var(--dsw-alias-label-primary)}",
      ".dsc-spin{display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dsc-spin .7s linear infinite;vertical-align:-2px}",
      "@keyframes dsc-spin{to{transform:rotate(360deg)}}",
    ].join("");

    const tagId = "dsh-community-plugins/community.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-community-plugins";
      tag.dataset.pluginCss = tagId;
      tag.textContent = cssText;
      document.head.appendChild(tag);
    }

    /* ------------------------------------------------------------------ *
     * Custom skin engine (plain DOM; works independent of the panel UI)
     * ------------------------------------------------------------------ */
    const SKIN_STORAGE_KEY = "dsc.skin";
    const SKIN_DEFAULTS = {
      enabled: false,
      imageUrl: "",
      imageMode: "cover", // cover | contain | repeat
      videoUrl: "",
      videoVolume: 0.5,
      videoMuted: false,
      blur: 0,
      opacity: 0, // panel background opacity, % — 0 lets the background show through untouched; 100 fully covers it
      brightness: 100,
      contrast: 100,
      saturate: 100,
      scale: 0, // background image zoom: -100 (shrink) .. 0 (original) .. +100 (enlarge)
      // Chat-input background: image fills the input card's right side with
      // a soft gradient transition; position/blur/opacity of the image and
      // the input card's own transparency are adjustable.
      inputBg: {
        enabled: false,
        imageUrl: "",
        mode: "fill",   // fill | fit | stretch | repeat | center | cross
        transition: 55, // gradient midpoint from the left, %
        posX: 50,       // image horizontal anchor, %
        posY: 50,       // image vertical anchor, %
        blur: 0,        // image blur (frosted), px
        opacity: 100,   // image opacity, %
        inputOpacity: 100, // input card transparency, % (100 = opaque)
        scale: 0,       // image zoom: -100 .. 0 .. +100
      },
      // Popover / drawer surfaces (command menu, model picker, skin & plugin
      // drawers…): independent of the global background transparency so they
      // stay readable even when the main skin is fully transparent.
      popBg: {
        alpha: 40,  // surface opacity, % (100 = opaque)
        blur: 10,   // frosted-glass blur behind the surface, px
        grain: 5,   // grain texture strength, % (0 = off)
      },
      // AI reply text color. Empty = keep the app's default; any hex color
      // overrides the assistant message body (via --dsc-chat-color).
      chatColor: "",
      // My sent messages: user bubble background + text color. Empty = default.
      inputBox: {
        bgColor: "",   // user message bubble background, hex or empty
        textColor: "", // user message text color, hex or empty
        opacity: 100,  // bubble background opacity, % (100 = opaque)
        blur: 0,       // frosted-glass blur behind the bubble, px
      },
    };

    function readSkin() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(SKIN_STORAGE_KEY) || "{}");
        // Migrate the old default (opacity 100, untouched sliders): it fully
        // covered the background on panels that use plain variable fills.
        if (parsed.opacity === 100 && parsed.blur === 0 && parsed.brightness === 100 && parsed.contrast === 100 && parsed.saturate === 100) {
          parsed.opacity = SKIN_DEFAULTS.opacity;
        }
        return { ...SKIN_DEFAULTS, ...parsed };
      } catch {
        return { ...SKIN_DEFAULTS };
      }
    }

    /** Authoritative settings from the host (survives restarts; Electron
     *  localStorage is not reliably flushed before shutdown). */
    async function loadSkinFromServer() {
      try {
        const res = await fetch("/community/skin");
        const data = await res.json();
        if (data && data.ok && data.value) return { ...SKIN_DEFAULTS, ...data.value };
      } catch { /* fall through to localStorage */ }
      return readSkin();
    }

    let skinPersistTimer = null;

    function persistSkin(cfg) {
      try { window.localStorage.setItem(SKIN_STORAGE_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
      clearTimeout(skinPersistTimer);
      skinPersistTimer = setTimeout(() => {
        fetch("/community/skin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(cfg),
        }).catch(() => { /* transient */ });
      }, 400);
    }

    /** Upload a locally-picked file so it stays available after a restart. */
    async function uploadSkinAsset(file) {
      const name = `${Date.now().toString(36)}-${String(file.name || "asset").replace(/[^A-Za-z0-9._-]/g, "_")}`;
      const res = await fetch("/community/asset?name=" + encodeURIComponent(name), { method: "POST", body: file });
      const data = await res.json().catch(() => null);
      if (!data || data.ok !== true) throw new Error((data && data.message) || "文件上传失败");
      return data.url;
    }

    function writeSkin(cfg) {
      try { window.localStorage.setItem(SKIN_STORAGE_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
      try { applySkin(cfg); } catch { /* skin code must never break the app */ }
      persistSkin(cfg);
    }

    let skinNodes = null;
    let skinStyleTag = null;

    function ensureSkinNodes() {
      if (skinNodes) return skinNodes;
      const root = document.createElement("div");
      root.id = "dsc-skin-root";
      root.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden";
      const media = document.createElement("div");
      media.id = "dsc-skin-media";
      media.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
      const blur = document.createElement("div");
      blur.id = "dsc-skin-blur";
      blur.style.cssText = "position:absolute;inset:0;width:100%;height:100%;backdrop-filter:none";
      root.appendChild(media);
      root.appendChild(blur);
      document.body.appendChild(root);
      skinNodes = { root, media, blur };
      return skinNodes;
    }

    function removeSkinNodes() {
      if (skinNodes) {
        try { skinNodes.root.remove(); } catch { /* ignore */ }
        skinNodes = null;
      }
    }

    function ensureSkinStyle() {
      if (skinStyleTag) return skinStyleTag;
      skinStyleTag = document.createElement("style");
      skinStyleTag.id = "dsc-skin-css";
      document.head.appendChild(skinStyleTag);
      return skinStyleTag;
    }

    const cssUrlEscape = (s) => String(s).replace(/["\\]/g, "\\$&");

    /** Zoom slider (-100..+100) → transform scale ratio (0.1 .. 2.0). */
    const scaleRatio = (value) => {
      const pct = Math.min(Math.max(Number(value ?? 0), -100), 100);
      return String(Math.max(100 + pct, 10) / 100);
    };

    // Last applied config, used to skip redundant re-applies. Rebuilding the
    // background video on every slider tick makes the main background blink
    // (destroy + re-decode), so only parts that actually changed get updated.
    let lastSkinCfg = null;

    const inputBgFields = ["enabled", "imageUrl", "mode", "transition", "posX", "posY", "blur", "opacity", "inputOpacity", "scale"];

    const cfgFieldDiff = (a, b, fields) => {
      for (const k of fields) if (a?.[k] !== b?.[k]) return true;
      return false;
    };

    function applySkin(cfg) {
      const prev = lastSkinCfg;
      // Chat-input background and its transparency are independent of the
      // global background switch: touch them only when they changed.
      if (!prev || cfgFieldDiff(prev.inputBg, cfg && cfg.inputBg, inputBgFields)) {
        applyInputBg(cfg && cfg.inputBg);
        applyInputOpacity(cfg && cfg.inputBg);
      }
      // Popover/drawer surfaces follow their own opacity/blur/grain settings,
      // independent of the global background switch.
      if (!prev || cfgFieldDiff(prev.popBg, cfg && cfg.popBg, ["alpha", "blur", "grain"])) {
        applyPopBg(cfg && cfg.popBg);
      }
      // AI reply text color.
      if (!prev || ((prev.chatColor ?? "") !== ((cfg && cfg.chatColor) ?? ""))) {
        applyChatColor(cfg && cfg.chatColor);
      }
      // My sent messages colors.
      if (!prev || cfgFieldDiff(prev.inputBox, cfg && cfg.inputBox, ["bgColor", "textColor", "opacity", "blur"])) {
        applyInputBox(cfg && cfg.inputBox);
      }
      // The background layer is what gets frosted: the app UI turns slightly
      // translucent and blurs what sits behind it, so the effect also works
      // on top of a community theme skin (as long as a background exists).
      const bgActive = Boolean(cfg && cfg.enabled && (cfg.imageUrl || cfg.videoUrl));
      const prevActive = Boolean(prev && prev.enabled && (prev.imageUrl || prev.videoUrl));
      if (!bgActive) {
        if (prevActive || !prev) {
          if (skinStyleTag) skinStyleTag.textContent = "";
          document.documentElement.classList.remove("dsc-skin-on");
          removeSkinNodes();
        }
        lastSkinCfg = cfg;
        return;
      }
      const nodes = ensureSkinNodes();
      const blur = Math.min(Math.max(Number(cfg.blur) || 0, 0), 40);
      const a = Math.min(Math.max(Number(cfg.opacity ?? 100), 0), 100) / 100;
      const filter = `brightness(${cfg.brightness}%) contrast(${cfg.contrast}%) saturate(${cfg.saturate}%)`;

      // Rebuild the media element only when its source/type actually changed;
      // otherwise just refresh the live styles (filter/scale/volume/muted).
      const mediaChanged = !prev || prev.imageUrl !== cfg.imageUrl || prev.videoUrl !== cfg.videoUrl || prev.imageMode !== cfg.imageMode;
      if (mediaChanged) {
        if (cfg.videoUrl) {
          nodes.media.innerHTML = "";
          const video = document.createElement("video");
          video.preload = "auto"; // start buffering as early as possible at boot
          video.src = cfg.videoUrl;
          video.autoplay = true;
          video.loop = true;
          video.muted = cfg.videoMuted;
          video.volume = Math.min(Math.max(Number(cfg.videoVolume) || 0, 0), 1);
          video.style.cssText = "width:100%;height:100%;object-fit:cover;filter:" + filter + ";transform:scale(" + scaleRatio(cfg.scale) + ")";
          nodes.media.appendChild(video);
        } else {
          nodes.media.innerHTML = "";
          nodes.media.style.backgroundImage = `url("${cssUrlEscape(cfg.imageUrl)}")`;
          nodes.media.style.backgroundSize = cfg.imageMode === "repeat" ? "auto" : (cfg.imageMode === "contain" ? "contain" : "cover");
          nodes.media.style.backgroundPosition = "center";
          nodes.media.style.backgroundRepeat = cfg.imageMode === "repeat" ? "repeat" : "no-repeat";
          nodes.media.style.filter = filter;
          nodes.media.style.transform = "scale(" + scaleRatio(cfg.scale) + ")";
        }
      } else {
        const video = nodes.media.querySelector("video");
        if (video) {
          video.muted = cfg.videoMuted;
          video.volume = Math.min(Math.max(Number(cfg.videoVolume) || 0, 0), 1);
          video.style.filter = filter;
          video.style.transform = "scale(" + scaleRatio(cfg.scale) + ")";
        } else {
          nodes.media.style.filter = filter;
          nodes.media.style.transform = "scale(" + scaleRatio(cfg.scale) + ")";
        }
      }
      // Soft-focus the background image itself.
      nodes.blur.style.backdropFilter = blur > 0 ? `blur(${blur}px)` : "none";

      const tint = (r, g, b) => `rgba(${r},${g},${b},${a})`;
      const rules = [
        "html.dsc-skin-on,html.dsc-skin-on body{background:transparent}",
        "html.dsc-skin-on :root{",
        `--dsw-alias-bg-base:${tint(18,18,20)};`,
        `--dsw-alias-bg-layer-1:${tint(24,24,27)};`,
        `--dsw-alias-bg-layer-2:${tint(30,30,34)};`,
        `--dsw-alias-bg-layer-3:${tint(36,36,40)};`,
        `--dsw-specific-sidebar-fill:${tint(22,22,24)};`,
        `--dsw-alias-bg-module-platform:${tint(40,40,44)};`,
        "}",
        "html.dsc-skin-on body{",
        `--dsw-alias-bg-base:${tint(18,18,20)};`,
        `--dsw-alias-bg-layer-1:${tint(24,24,27)};`,
        `--dsw-alias-bg-layer-2:${tint(30,30,34)};`,
        `--dsw-alias-bg-layer-3:${tint(36,36,40)};`,
        `--dsw-specific-sidebar-fill:${tint(22,22,24)};`,
        `--dsw-alias-bg-module-platform:${tint(40,40,44)};`,
        "}",
      ];
      if (blur > 0) {
        // Frosted glass across the whole app: the translucent UI containers
        // blur the background layer behind them. Works with community themes
        // too, since they consume the same variables.
        rules.push(`html.dsc-skin-on body > div > div{backdrop-filter:blur(${blur}px)}`);
      }
      ensureSkinStyle().textContent = rules.join("\n");
      document.documentElement.classList.add("dsc-skin-on");
      lastSkinCfg = cfg;
    }

    /** Locate the chat input card (the solid-background wrapper of <textarea>). */
    function findInputCard() {
      const ta = document.querySelector("textarea");
      if (!ta) return null;
      let el = ta.parentElement;
      while (el && el !== document.body) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return el;
        el = el.parentElement;
      }
      return ta.parentElement;
    }

    /**
     * Chat-input background. A ::before pseudo-layer carries the image (so
     * blur/opacity/position hit the image only) with its original aspect
     * ratio (height fills the card, width may overflow and slide); a ::after
     * layer carries the gradient fade overlay. The display mode picks the
     * sizing/repeat/position recipe; "cross" grows the layer beyond the card
     * so the full image can span past the input area.
     */
    function applyInputBg(inputBg) {
      const active = Boolean(inputBg && inputBg.enabled && inputBg.imageUrl);
      const card = findInputCard();
      if (!active || !card) {
        if (card) card.classList.remove("dsc-input-bg", "dsc-cross");
        return;
      }
      const mid = Math.min(Math.max(Number(inputBg.transition) || 55, 10), 90);
      const solid = Math.max(mid - 12, 0);
      const fade = Math.min(mid + 22, 100);
      const mode = inputBg.mode || "fill";
      // Scale slider → displayed image width as a % of the input card:
      // 0 = the image's width exactly matches the card (both sides flush),
      // + = enlarged (edges crop, position sliders slide it), - = shrunk
      // (the card bottom shows through). The image keeps its aspect ratio
      // (height follows width); only stretch mode scales both axes.
      const sw = 100 + Math.min(Math.max(Number(inputBg.scale) || 0, -100), 100);
      const size =
        mode === "stretch" ? `${sw}% ${sw}%` :
        mode === "fit" ? "contain" :
        `${sw}% auto`;
      card.classList.add("dsc-input-bg");
      card.classList.toggle("dsc-cross", mode === "cross");
      card.style.setProperty("--dsc-input-img", `url("${cssUrlEscape(inputBg.imageUrl)}")`);
      card.style.setProperty("--dsc-input-size", size);
      card.style.setProperty("--dsc-input-repeat", mode === "repeat" ? "repeat" : "no-repeat");
      card.style.setProperty("--dsc-input-pos", mode === "center" ? "center" : `${inputBg.posX}% ${inputBg.posY}%`);
      // The solid fade band shares the input card's transparency variable so
      // lowering the card opacity never leaves an opaque dark band over the
      // transition zone (the var() is resolved at paint time, after
      // applyInputOpacity has set it).
      card.style.setProperty("--dsc-input-grad", `linear-gradient(to right, rgba(44,44,46,var(--dsc-input-bg-alpha,1)) 0%, rgba(44,44,46,var(--dsc-input-bg-alpha,1)) ${solid}%, rgba(44,44,46,0) ${fade}%, rgba(44,44,46,0) 100%)`);
      card.style.setProperty("--dsc-input-blur", `${Math.min(Math.max(Number(inputBg.blur) || 0, 0), 40)}px`);
      card.style.setProperty("--dsc-input-opacity", String(Math.min(Math.max(Number(inputBg.opacity) ?? 100, 0), 100) / 100));
      // Fade the image itself across the transition band (matches the dark
      // gradient's solid/fade points), so the picture melts into the tinted
      // side instead of being covered by a hard edge. Cross mode spans the
      // whole layer, so its mask would misalign — skipped there.
      card.style.setProperty("--dsc-input-mask", mode === "cross"
        ? "none"
        : `linear-gradient(to right, transparent 0%, transparent ${solid}%, #000 ${fade}%, #000 100%)`);
    }

    /** Input-card transparency — independent of the input background switch. */
    function applyInputOpacity(inputBg) {
      const alpha = Math.min(Math.max(Number(inputBg && inputBg.inputOpacity) ?? 100, 0), 100) / 100;
      const card = findInputCard();
      if (!card) return;
      // Always refresh the variable (even at 100%): the gradient overlay
      // reads it, so stale values would leave the fade band semi-transparent
      // after the opacity was raised back up.
      card.style.setProperty("--dsc-input-bg-alpha", String(alpha));
      if (alpha >= 1) {
        card.classList.remove("dsc-inputCard");
        return;
      }
      card.classList.add("dsc-inputCard");
    }

    /** Popover/drawer surfaces: opacity, frosted blur, grain texture. */
    function applyPopBg(popBg) {
      const alpha = Math.min(Math.max(Number(popBg && popBg.alpha) ?? 100, 0), 100) / 100;
      const blur = Math.min(Math.max(Number(popBg && popBg.blur) || 0, 0), 40);
      const grain = Math.min(Math.max(Number(popBg && popBg.grain) || 0, 0), 100) * 0.35 / 100;
      const root = document.documentElement;
      root.style.setProperty("--dsc-pop-alpha", String(alpha));
      root.style.setProperty("--dsc-pop-blur", `${blur}px`);
      root.style.setProperty("--dsc-pop-grain", String(grain));
    }

    /** AI reply text color ("" keeps the app default via the var fallback). */
    function applyChatColor(color) {
      document.documentElement.style.setProperty("--dsc-chat-color", color ? String(color) : "");
    }

    /** Hex #rrggbb → rgba() with the given alpha; null for empty/invalid. */
    const hexToRgba = (hex, alpha) => {
      if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    };

    /** My sent messages: bubble background + text color ("" = default). */
    function applyInputBox(inputBox) {
      const root = document.documentElement;
      const alpha = Math.min(Math.max(Number(inputBox && inputBox.opacity) ?? 100, 0), 100) / 100;
      const blur = Math.min(Math.max(Number(inputBox && inputBox.blur) || 0, 0), 40);
      const bg = inputBox && inputBox.bgColor;
      // Opacity always applies: over the user color when set, else over the
      // theme's default bubble base (44,44,46), like the input card.
      root.style.setProperty("--dsc-inputbox-bg-rgba", hexToRgba(bg, alpha) || `rgba(44, 44, 46, ${alpha})`);
      root.style.setProperty("--dsc-inputbox-text", (inputBox && inputBox.textColor) ? String(inputBox.textColor) : "");
      root.style.setProperty("--dsc-inputbox-blur", `${blur}px`);
    }

    /** Initialize once at plugin apply: restore the persisted skin. */
    async function initSkin() {
      // The host web server may not be ready on the very first paint; retry
      // a few times instead of silently starting with the defaults.
      let cfg = null;
      for (let i = 0; i < 5 && !cfg; i++) {
        try {
          cfg = await loadSkinFromServer();
        } catch {
          await new Promise((r2) => setTimeout(r2, 400));
        }
      }
      if (!cfg) cfg = { ...SKIN_DEFAULTS };
      try {
        applySkin(cfg);
      } catch { /* never let skin code break the app */ }
      // The composer card may not exist yet on first paint; the input
      // background would silently stay off until the panel re-applies it.
      // Poll until the textarea shows up and the background is applied.
      let tries = 0;
      const timer = window.setInterval(() => {
        tries++;
        try {
          if (findInputCard()) {
            applyInputBg(cfg && cfg.inputBg);
            applyInputOpacity(cfg && cfg.inputBg);
            window.clearInterval(timer);
            return;
          }
        } catch { /* keep retrying */ }
        if (tries > 60) window.clearInterval(timer); // ~18s backstop
      }, 300);
      // The composer card is re-created by React on every conversation
      // switch / new session, which drops our classes. Keep a lightweight
      // observer alive: whenever a textarea exists without our background
      // classes (and the skin wants one), re-apply from the latest config.
      watchInputCard();
    }

    /** Keep the input background applied across conversation switches. */
    function watchInputCard() {
      const mo = new MutationObserver(() => {
        try {
          const cfg = lastSkinCfg;
          if (!cfg) return;
          const ib = cfg.inputBg || {};
          // Background image and the independent frosted transparency both
          // get dropped when React re-creates the composer card; restore
          // whichever is missing.
          const wantBg = Boolean(ib.enabled && ib.imageUrl);
          const wantOpacity = Number(ib.inputOpacity ?? 100) < 100;
          if (!wantBg && !wantOpacity) return;
          const card = findInputCard();
          if (!card) return;
          if ((wantBg && !card.classList.contains("dsc-input-bg")) || (wantOpacity && !card.classList.contains("dsc-inputCard"))) {
            applyInputBg(ib);
            applyInputOpacity(ib);
          }
        } catch { /* observer must never throw */ }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    /* ------------------------------------------------------------------ *
     * Dictionaries
     * ------------------------------------------------------------------ */
    const zh = {
      "title": "社区插件",
      "open": "打开社区插件中心",
      "close": "关闭",
      "search": "搜索插件…",
      "refresh": "刷新",
      "all": "全部",
      "onlyInstalled": "已安装",
      "onlyAvailable": "可安装",
      "updateAll": "检查更新",
      "updateAllBusy": "检查中…",
      "updateAllOk": "所有已安装插件均是最新版 ✓",
      "updateAllDone": "已更新 ",
      "updateAllFail": "更新失败 ",
      "updateAllSkipped": "自动更新已关闭或 12 小时内已检查过",
      "autoUpdateToggle": "自动更新（启动时与 GitHub 同步）",
      "install": "安装",
      "installing": "下载中…",
      "installed": "已安装",
      "update": "更新",
      "updating": "更新中…",
      "updatedOk": "已更新",
      "uninstall": "卸载",
      "disable": "禁用",
      "enable": "启用",
      "refreshPage": "刷新页面",
      "installedHint": "已安装！重启 DeepSeek Harness 以加载它的界面。",
      "needsRestartHint": "重启应用后生效",
      "loading": "正在连接社区…",
      "error": "连接社区失败：",
      "retry": "重试",
      "empty": "没有找到匹配的插件",
      "loadMore": "加载更多",
      "shown": "显示",
      "bundle": "Bundle",
      "client": "客户端",
      "plugin": "插件",
      "stars": "★",
      "noPackage": "非插件仓库",
      "repoLink": "查看仓库",
      "installDir": "安装位置",
      "changeDir": "更改",
      "saveDir": "保存",
      "cancelDir": "取消",
      "dirSaved": "安装位置已保存，仅影响新安装的插件",
      "dirPlaceholder": "如 D:\\dsh-plugins",
      "dirInvalid": "路径不可写或无效",
      "mirror": "数据源",
      "sourceAuto": "自动（智能回退）",
      "sourceGithub": "GitHub 直连",
      "github": "GitHub 社区页面",
      "updated": "更新于",
      "confirmUninstall": "确定卸载该插件？",
      "installedDisabled": "已禁用",
      "needsRestart": "该插件需要重启 DSH 后生效",
      "uninstalled": "已卸载",
      "skinTitle": "自定义皮肤",
      "skinOpen": "打开自定义皮肤",
      "skinEnabled": "启用背景",
      "skinBgImage": "背景图片",
      "skinBgVideo": "背景视频",
      "skinUrl": "图片 / 视频 URL",
      "skinLocal": "选择本地文件",
      "skinLocalSaved": "本地文件已保存（重启后依然有效）",
      "skinUploading": "上传中…",
      "skinLocalHint": "本地文件在重启应用后需重新选择",
      "skinMode": "显示模式",
      "skinModeCover": "封面",
      "skinModeContain": "适应",
      "skinModeRepeat": "平铺",
      "skinVolume": "音量",
      "skinMuted": "静音",
      "skinBlur": "模糊（毛玻璃）",
      "skinOpacity": "界面透明",
      "skinBrightness": "亮度",
      "skinContrast": "对比度",
      "skinSaturate": "饱和度",
      "skinScale": "图片缩放",
      "skinFilterReset": "滤镜恢复默认",
      "skinEffects": "效果",
      "skinFilters": "滤镜",
      "skinReset": "恢复默认",
      "skinResetOk": "已恢复默认皮肤",
      "skinClearBg": "清除背景",
      "skinNoBgHint": "模糊 / 透明 / 滤镜需要背景层才能生效，请先设置背景图片或视频（主题模式下同样适用）",
      "chatBgTitle": "输入框背景",
      "chatBgEnable": "启用输入框背景",
      "chatBgMode": "图片模式",
      "chatBgModeFill": "填充",
      "chatBgModeFit": "适应",
      "chatBgModeStretch": "拉伸",
      "chatBgModeRepeat": "平铺",
      "chatBgModeCenter": "居中",
      "chatBgModeCross": "跨区",
      "chatBgTransition": "过渡位置",
      "chatBgPosX": "图片左右位置",
      "chatBgPosY": "图片上下位置",
      "chatBgBlur": "图片模糊",
      "chatBgOpacity": "图片透明",
      "chatBgInputOpacity": "输入框透明",
      "inputOpacityTitle": "输入框透明",
      "popBgTitle": "展开框背景",
      "popBgHint": "作用于命令菜单、模型选择、工作区、搜索等弹出框，以及自定义皮肤和社区插件面板",
      "popBgAlpha": "透明度",
      "popBgBlur": "模糊度",
      "popBgGrain": "颗粒度",
      "popBgReset": "恢复默认",
      "chatColorTitle": "AI 回复文本",
      "chatColorLabel": "颜色",
      "chatColorDefault": "默认",
      "chatColorReset": "恢复默认",
      "inputBoxTitle": "我发送的消息",
      "inputBoxBg": "消息颜色",
      "inputBoxText": "文字颜色",
      "inputBoxOpacity": "透明度",
      "inputBoxBlur": "模糊度",
      "chatBgDragHint": "拖动调整图片位置",
      "skinMarket": "社区皮肤",
      "skinRestartHint": "下载或切换皮肤后，重启客户端刷新生效",
      "skinNone": "无（官方默认）",
      "skinNoneApplied": "已恢复官方默认外观",
      "skinDownload": "下载",
      "skinDownloading": "下载中…",
      "skinApply": "切换",
      "skinRemove": "卸载",
      "skinUsing": "使用中",
      "skinInstalled": "已安装",
      "skinNeedRestart": "重启应用后生效",
      "skinApplied": "已切换，重启应用后生效",
      "skinRemoved": "已卸载，恢复默认",
    };
    const en = {
      "title": "Community Plugins",
      "open": "Open community plugin center",
      "close": "Close",
      "search": "Search plugins…",
      "refresh": "Refresh",
      "all": "All",
      "onlyInstalled": "Installed",
      "onlyAvailable": "Installable",
      "updateAll": "Check updates",
      "updateAllBusy": "Checking…",
      "updateAllOk": "All installed plugins are up to date ✓",
      "updateAllDone": "Updated ",
      "updateAllFail": "Update failed for ",
      "updateAllSkipped": "Auto-update disabled or checked within 12h",
      "autoUpdateToggle": "Auto-update (sync with GitHub on boot)",
      "install": "Install",
      "installing": "Downloading…",
      "installed": "Installed",
      "update": "Update",
      "updating": "Updating…",
      "updatedOk": "Updated",
      "uninstall": "Remove",
      "disable": "Disable",
      "enable": "Enable",
      "refreshPage": "Reload page",
      "installedHint": "Installed! Restart DeepSeek Harness to load its UI.",
      "needsRestartHint": "Takes effect after restart",
      "loading": "Connecting to the community…",
      "error": "Failed to reach the community:",
      "retry": "Retry",
      "empty": "No matching plugins found",
      "loadMore": "Load more",
      "shown": "Showing",
      "bundle": "Bundle",
      "client": "Client",
      "plugin": "Plugin",
      "stars": "★",
      "noPackage": "Not a plugin repo",
      "repoLink": "View repo",
      "installDir": "Install location",
      "changeDir": "Change",
      "saveDir": "Save",
      "cancelDir": "Cancel",
      "dirSaved": "Install location saved, applies to new installs",
      "dirPlaceholder": "e.g. D:\\dsh-plugins",
      "dirInvalid": "Path is not writable",
      "mirror": "Source",
      "sourceAuto": "Auto (smart fallback)",
      "sourceGithub": "GitHub direct",
      "github": "GitHub topic page",
      "updated": "Updated",
      "confirmUninstall": "Remove this plugin?",
      "installedDisabled": "Disabled",
      "needsRestart": "This plugin takes effect after restarting DSH",
      "uninstalled": "Uninstalled",
      "skinTitle": "Custom Skin",
      "skinOpen": "Open custom skin",
      "skinEnabled": "Enable background",
      "skinBgImage": "Background image",
      "skinBgVideo": "Background video",
      "skinUrl": "Image / video URL",
      "skinLocal": "Choose local file",
      "skinLocalSaved": "Local file saved (persists across restarts)",
      "skinUploading": "Uploading…",
      "skinLocalHint": "Local files need re-selecting after app restart",
      "skinMode": "Mode",
      "skinModeCover": "Cover",
      "skinModeContain": "Contain",
      "skinModeRepeat": "Repeat",
      "skinVolume": "Volume",
      "skinMuted": "Muted",
      "skinBlur": "Blur (frosted glass)",
      "skinOpacity": "UI transparency",
      "skinBrightness": "Brightness",
      "skinContrast": "Contrast",
      "skinSaturate": "Saturation",
      "skinScale": "Image scale",
      "skinFilterReset": "Reset filters",
      "skinEffects": "Effects",
      "skinFilters": "Filters",
      "skinReset": "Reset to default",
      "skinResetOk": "Skin reset to default",
      "skinClearBg": "Clear background",
      "skinNoBgHint": "Blur / transparency / filters need a background layer — set an image or video first (also works on top of community themes)",
      "chatBgTitle": "Input background",
      "chatBgEnable": "Enable input background",
      "chatBgMode": "Image mode",
      "chatBgModeFill": "Fill",
      "chatBgModeFit": "Fit",
      "chatBgModeStretch": "Stretch",
      "chatBgModeRepeat": "Tile",
      "chatBgModeCenter": "Center",
      "chatBgModeCross": "Span",
      "chatBgTransition": "Transition position",
      "chatBgPosX": "Image X position",
      "chatBgPosY": "Image Y position",
      "chatBgBlur": "Image blur",
      "chatBgOpacity": "Image opacity",
      "chatBgInputOpacity": "Input transparency",
      "inputOpacityTitle": "Input transparency",
      "popBgTitle": "Popover background",
      "popBgHint": "Applies to the command menu, model/permission pickers, workspace & search overlays, and the custom skin / community drawers",
      "popBgAlpha": "Opacity",
      "popBgBlur": "Blur",
      "popBgGrain": "Grain",
      "popBgReset": "Reset",
      "chatColorTitle": "AI reply text",
      "chatColorLabel": "Color",
      "chatColorDefault": "Default",
      "chatColorReset": "Reset",
      "inputBoxTitle": "My messages",
      "inputBoxBg": "Bubble color",
      "inputBoxText": "Text color",
      "inputBoxOpacity": "Opacity",
      "inputBoxBlur": "Blur",
      "chatBgDragHint": "Drag to move the image",
      "skinMarket": "Community skins",
      "skinRestartHint": "Restart the app to refresh after downloading or switching skins",
      "skinNone": "None (official default)",
      "skinNoneApplied": "Back to official default look",
      "skinDownload": "Download",
      "skinDownloading": "Downloading…",
      "skinApply": "Apply",
      "skinRemove": "Remove",
      "skinUsing": "In use",
      "skinInstalled": "Installed",
      "skinNeedRestart": "Takes effect after app restart",
      "skinApplied": "Applied, restart the app to see it",
      "skinRemoved": "Removed, back to default",
    };

    const NS = "community.plugins";

    /** Built-in source list, used until /community/sources responds. */
    const FALLBACK_SOURCES = [
      { key: "auto", labelZh: "自动（智能回退）", label: "Auto" },
      { key: "github", labelZh: "GitHub 直连", label: "GitHub" },
      { key: "ghproxy", labelZh: "ghproxy.net", label: "ghproxy.net" },
      { key: "ghfast", labelZh: "ghfast.top", label: "ghfast.top" },
      { key: "ghproxycom", labelZh: "gh-proxy.com", label: "gh-proxy.com" },
      { key: "ghps", labelZh: "ghps.cc", label: "ghps.cc" },
      { key: "ghproxycc", labelZh: "ghproxy.cc", label: "ghproxy.cc" },
      { key: "ddlc", labelZh: "gh.ddlc.top", label: "gh.ddlc.top" },
      { key: "kkgithub", labelZh: "kkgithub.com", label: "kkgithub.com" },
      { key: "gitclone", labelZh: "gitclone.com", label: "gitclone.com" },
      { key: "gitmirror", labelZh: "hub.gitmirror.com", label: "hub.gitmirror.com" },
    ];

    function sourceLabel(s) {
      const zh = typeof navigator !== "undefined" && navigator.language && navigator.language.toLowerCase().startsWith("zh");
      return zh ? (s.labelZh ?? s.label ?? s.key) : (s.label ?? s.labelZh ?? s.key);
    }

    /** Download progress label from the host task status. */
    function taskLabel(t, task) {
      if (!task) return t("skinDownloading");
      if (task.message) return task.message;
      if (task.progress != null) return task.progress + "%";
      return t("skinDownloading");
    }

    function pickT() {
      const lang = typeof navigator !== "undefined" && navigator.language && navigator.language.toLowerCase().startsWith("zh")
        ? "zh"
        : "en";
      const dict = lang === "zh" ? zh : en;
      return (key) => dict[key] ?? en[key] ?? key;
    }

    /* ------------------------------------------------------------------ *
     * Host API (same-origin /community routes on the harness web server)
     * ------------------------------------------------------------------ */
    async function api(path, options) {
      const res = await fetch(path, options);
      let data = null;
      try { data = await res.json(); } catch { /* ignore */ }
      if (!data || data.ok !== true) {
        const message = data && (data.message || (data.error && data.error.message));
        throw new Error(message || `request failed (${res.status})`);
      }
      return data.value;
    }

    function post(path, body) {
      return api(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    /** Silent background sync at boot: update any outdated plugin via GitHub. */
    async function autoUpdateAtBoot() {
      try {
        const settings = await fetch("/community/settings").then((r) => r.json()).catch(() => null);
        if (!settings || settings.ok !== true || settings.value?.autoUpdate === false) return;
      } catch { return; }
      // Give the app a few seconds to settle, then sync quietly (the backend
      // throttles to once per 12h and never touches the running install on
      // failure). Updated bundles still need a restart to take effect.
      window.setTimeout(() => {
        fetch("/community/auto-update", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ force: false }) }).catch(() => { /* silent */ });
      }, 12000);
    }

    /* ------------------------------------------------------------------ *
     * Skin panel
     * ------------------------------------------------------------------ */
    function SkinPanel(props) {
      const t = props.t || pickT();
      const [open, setOpen] = React.useState(false);
      const [cfg, setCfg] = React.useState(readSkin);
      const [notice, setNotice] = React.useState(null);
      const [skins, setSkins] = React.useState([]);
      const [skinBusy, setSkinBusy] = React.useState({});
      const [tasks, setTasks] = React.useState({});
      const imgFileRef = React.useRef(null);
      const vidFileRef = React.useRef(null);
      const alive = React.useRef(true);

      const update = (patch) => {
        const next = { ...cfg, ...patch };
        // Importing a background image/video turns the background on by itself.
        if (next.imageUrl || next.videoUrl) next.enabled = true;
        setCfg(next);
        writeSkin(next);
      };

      const reset = () => {
        const next = { ...SKIN_DEFAULTS };
        setCfg(next);
        writeSkin(next);
        setNotice(t("skinResetOk"));
      };

      const clearBg = () => {
        const next = { ...cfg, imageUrl: "", videoUrl: "" };
        setCfg(next);
        writeSkin(next);
      };

      const loadSkins = React.useCallback(async () => {
        try {
          const list = await api("/community/skins");
          if (alive.current) setSkins(list || []);
        } catch { /* market is best-effort */ }
      }, []);

      React.useEffect(() => {
        alive.current = true;
        // Authoritative settings from the host (restart-safe).
        loadSkinFromServer().then((saved) => {
          if (!alive.current) return;
          setCfg(saved);
          applySkin(saved);
        }).catch(() => { /* keep local state */ });
        if (open) loadSkins();
        return () => { alive.current = false; };
      }, [open, loadSkins]);

      const skinAction = async (skin, action) => {
        setSkinBusy((b) => ({ ...b, [skin.key]: true }));
        setNotice(null);
        // Poll download progress while the install request is in flight.
        let poll = null;
        if (action === "install") {
          poll = window.setInterval(async () => {
            try {
              const list = await api("/community/tasks");
              const map = {};
              for (const t of list || []) map[t.repo] = t;
              setTasks(map);
            } catch { /* transient */ }
          }, 800);
        }
        try {
          if (action === "install") {
            const res = await post("/community/install", { repo: skin.repo, path: skin.path });
            setNotice(String(res && res.message ? res.message : "") + " —— " + t("skinNeedRestart"));
          } else if (action === "apply") {
            // Only one skin at a time: disable every other installed skin first.
            for (const other of skins) {
              if (other.installed && other.enabled && other.key !== skin.key) {
                try { await post("/community/set-enabled", { repo: other.key, enabled: false }); } catch { /* ignore */ }
              }
            }
            await post("/community/set-enabled", { repo: skin.key, enabled: true });
            setNotice(t("skinApplied"));
          } else if (action === "none") {
            // Restore the official default look: disable every installed skin.
            for (const other of skins) {
              if (other.installed && other.enabled) {
                try { await post("/community/set-enabled", { repo: other.key, enabled: false }); } catch { /* ignore */ }
              }
            }
            setNotice(t("skinNoneApplied"));
          } else if (action === "remove") {
            const res = await post("/community/uninstall", { repo: skin.key });
            setNotice(String(res && res.message ? res.message : "") + " —— " + t("skinRemoved"));
          }
          await loadSkins();
        } catch (e) {
          setNotice(String(e.message || e));
        } finally {
          if (poll) window.clearInterval(poll);
          setSkinBusy((b) => { const next = { ...b }; delete next[skin.key]; return next; });
        }
      };

      const pickLocal = (kind) => async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          setNotice(t("skinUploading"));
          const url = await uploadSkinAsset(file);
          if (kind === "image") update({ imageUrl: url, videoUrl: "" });
          else update({ videoUrl: url, imageUrl: "" });
          setNotice(t("skinLocalSaved"));
        } catch (err) {
          setNotice(String(err.message || err));
        }
        e.target.value = "";
      };

      const inputUpdate = (patch) => update({ inputBg: { ...(cfg.inputBg || {}), ...patch } });
      const inputBoxUpdate = (patch) => update({ inputBox: { ...(cfg.inputBox || {}), ...patch } });
      const [dragPreview, setDragPreview] = React.useState(null);
      const previewRef = React.useRef(null);

      React.useEffect(() => {
        if (!dragPreview) return undefined;
        const onMove = (e) => {
          const { startX, startY, baseX, baseY, rect } = dragPreview;
          const dx = ((e.clientX - startX) / rect.width) * 100;
          const dy = ((e.clientY - startY) / rect.height) * 100;
          inputUpdate({
            posX: Math.round(Math.min(Math.max(baseX + dx, 0), 100)),
            posY: Math.round(Math.min(Math.max(baseY + dy, 0), 100)),
          });
        };
        const onUp = () => setDragPreview(null);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
      }, [dragPreview]);

      const onPreviewDown = (e) => {
        e.preventDefault();
        const rect = previewRef.current && previewRef.current.getBoundingClientRect();
        if (!rect) return;
        setDragPreview({
          startX: e.clientX,
          startY: e.clientY,
          baseX: (cfg.inputBg && cfg.inputBg.posX) ?? 50,
          baseY: (cfg.inputBg && cfg.inputBg.posY) ?? 50,
          rect,
        });
      };

      const inputPickLocal = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          setNotice(t("skinUploading"));
          const url = await uploadSkinAsset(file);
          inputUpdate({ imageUrl: url });
          setNotice(t("skinLocalSaved"));
        } catch (err) {
          setNotice(String(err.message || err));
        }
        e.target.value = "";
      };

      // Mirror of the mode→background-size recipe used by applyInputBg, for
      // the drag preview box.
      const previewBgSize = (ib) => {
        const mode = (ib && ib.mode) || "fill";
        const sw = 100 + Math.min(Math.max(Number(ib && ib.scale) || 0, -100), 100);
        return mode === "stretch" ? `${sw}% ${sw}%`
          : mode === "fit" ? "contain"
          : `${sw}% auto`;
      };

      // Same image fade as applyInputBg, so the preview shows the transition.
      const previewMask = (ib) => {
        if (!ib || ib.mode === "cross") return "none";
        const mid = Math.min(Math.max(Number(ib.transition) || 55, 10), 90);
        const solid = Math.max(mid - 12, 0);
        const fade = Math.min(mid + 22, 100);
        return `linear-gradient(to right, transparent 0%, transparent ${solid}%, #000 ${fade}%, #000 100%)`;
      };

      const slider = (label, key, min, max, step = 1, suffix = "", path) => {        const current = path ? (cfg[path] || {}) : cfg;
        const defs = path ? (SKIN_DEFAULTS[path] || {}) : SKIN_DEFAULTS;
        return jsxs("div", { key: key, className: "dsc-row", children: [
          jsx("span", { key: "l", className: "dsc-rowLabel", children: label }),
          jsx("input", {
            key: "r",
            type: "range",
            className: "dsc-range",
            min: min,
            max: max,
            step: step,
            value: current[key] ?? defs[key],
            onChange: (e) => {
              const value = Number(e.target.value);
              if (path) update({ [path]: { ...(cfg[path] || {}), [key]: value } });
              else update({ [key]: value });
            },
          }),
          jsx("span", { key: "v", className: "dsc-rangeVal", children: String(current[key] ?? defs[key]) + suffix }),
        ] });
      };

      return jsx(Fragment, { children: [
        jsx("button", {
          key: "entry",
          type: "button",
          className: "dsc-footerButton" + (props.wide ? "" : " dsc-footerButtonIcon"),
          "aria-label": t("skinOpen"),
          title: t("skinOpen"),
          onClick: () => setOpen(true),
          children: [
            jsx("svg", { key: "icon", width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: jsx("path", { d: "M7.98 1.6a6.4 6.4 0 1 0 6.4 6.4 6.4 6.4 0 0 0-6.4-6.4Zm2.93 3.55a1.2 1.2 0 0 1 .85 2.07 1.2 1.2 0 0 1-1.7 0 4.1 4.1 0 0 0-5.97 5.28A5.6 5.6 0 0 1 7.98 2.4a5.6 5.6 0 0 1 2.93 2.75Z", fill: "currentColor" }) }),
            props.wide ? jsx("span", { key: "label", className: "dsc-footerLabel", children: t("skinTitle") }) : null,
          ],
        }),
        open ? jsx(Fragment, { key: "panel", children: [
          jsx("div", { key: "backdrop", className: "dsc-backdrop", onClick: () => setOpen(false) }),
          jsx("div", { key: "drawer", className: "dsc-drawer", children: [
            jsx("div", { key: "head", className: "dsc-head", children: [
              jsx("span", { key: "title", className: "dsc-title", children: t("skinTitle") }),
              jsx("button", { key: "close", type: "button", className: "dsc-close", "aria-label": t("close"), onClick: () => setOpen(false), children: "×" }),
            ] }),
            jsx("div", { key: "body", className: "dsc-body", children: [
              jsx("div", { key: "market", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("skinMarket") }),
                jsx("div", { key: "hint", className: "dsc-hint", children: t("skinRestartHint") }),
                // "None" row: restore the official look (disables every skin).
                jsx("div", { key: "none", className: "dsc-skinRow", children: [
                  jsx("span", { key: "name", className: "dsc-skinName", children: t("skinNone") }),
                  !skins.some((s) => s.enabled)
                    ? jsx("span", { key: "st", className: "dsc-badge dsc-badgeInstalled", children: t("skinUsing") })
                    : null,
                  jsx("span", { key: "sp", className: "dsc-skinSpacer" }),
                  jsx("button", {
                    key: "ap",
                    type: "button",
                    className: "dsc-btn",
                    onClick: () => skinAction({ key: "__none__" }, "none"),
                    children: t("skinApply"),
                  }),
                ] }),
                skins.length === 0
                  ? jsx("div", { key: "empty", className: "dsc-empty", children: t("loading") })
                  : skins.map((s) => jsx("div", { key: s.key, className: "dsc-skinRow", children: [
                      jsx("span", { key: "name", className: "dsc-skinName", title: s.key, children: s.name }),
                      s.installed
                        ? jsx("span", { key: "st", className: "dsc-badge" + (s.enabled ? " dsc-badgeInstalled" : ""), children: s.enabled ? t("skinUsing") : t("skinInstalled") })
                        : null,
                      jsx("span", { key: "sp", className: "dsc-skinSpacer" }),
                      !s.installed
                        ? jsx("button", {
                            key: "dl",
                            type: "button",
                            className: "dsc-btn dsc-btnPrimary",
                            disabled: skinBusy[s.key],
                            onClick: () => skinAction(s, "install"),
                            children: skinBusy[s.key]
                              ? [jsx("span", { key: "s", className: "dsc-spin" }), " ", taskLabel(t, tasks[s.repo])]
                              : t("skinDownload"),
                          })
                        : s.enabled
                          ? jsx("button", {
                              key: "rm",
                              type: "button",
                              className: "dsc-btn dsc-btnDanger",
                              disabled: skinBusy[s.key],
                              onClick: () => skinAction(s, "remove"),
                              children: t("skinRemove"),
                            })
                          : jsx("button", {
                              key: "ap",
                              type: "button",
                              className: "dsc-btn",
                              disabled: skinBusy[s.key],
                              onClick: () => skinAction(s, "apply"),
                              children: t("skinApply"),
                            }),
                    ] })),
              ] }),
              jsx("div", { key: "enable", className: "dsc-row", children: [
                jsx("span", { key: "label", className: "dsc-rowLabel", children: t("skinEnabled") }),
                jsx("label", { key: "switch", className: "dsc-switch", children: [
                  jsx("input", { key: "box", type: "checkbox", checked: cfg.enabled, onChange: (e) => update({ enabled: e.target.checked }) }),
                  jsx("span", { key: "track", className: "dsc-switchTrack", children: jsx("span", { className: "dsc-switchThumb" }) }),
                ] }),
              ] }),
              notice ? jsx("div", { key: "notice", className: "dsc-notice", children: jsx("span", { children: notice }) }) : null,
              jsx("div", { key: "bg", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("skinBgImage") }),
                jsx("div", { key: "row1", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("skinUrl") }),
                  jsx("input", {
                    key: "i",
                    className: "dsc-textInput",
                    type: "text",
                    placeholder: "https://…",
                    value: cfg.imageUrl && !cfg.videoUrl ? cfg.imageUrl : "",
                    onChange: (e) => update({ imageUrl: e.target.value, videoUrl: "" }),
                  }),
                ] }),
                jsx("div", { key: "row2", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("skinLocal") }),
                  jsx("input", { key: "f", ref: imgFileRef, className: "dsc-fileInput", type: "file", accept: "image/*", onChange: pickLocal("image") }),
                  jsx("button", { key: "b", type: "button", className: "dsc-btn", onClick: () => imgFileRef.current && imgFileRef.current.click(), children: t("skinLocal") }),
                  jsx("button", { key: "c", type: "button", className: "dsc-btn", onClick: clearBg, children: t("skinClearBg") }),
                ] }),
                jsx("div", { key: "row3", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("skinMode") }),
                  ["cover", "contain", "repeat"].map((m) =>
                    jsx("button", {
                      key: m,
                      type: "button",
                      className: "dsc-chip" + (cfg.imageMode === m ? " dsc-chipOn" : ""),
                      onClick: () => update({ imageMode: m }),
                      children: t(m === "cover" ? "skinModeCover" : m === "contain" ? "skinModeContain" : "skinModeRepeat"),
                    })),
                ] }),
              ] }),
              jsx("div", { key: "vid", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("skinBgVideo") }),
                jsx("div", { key: "row1", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("skinUrl") }),
                  jsx("input", {
                    key: "i",
                    className: "dsc-textInput",
                    type: "text",
                    placeholder: "https://…",
                    value: cfg.videoUrl ? cfg.videoUrl : "",
                    onChange: (e) => update({ videoUrl: e.target.value, imageUrl: "" }),
                  }),
                ] }),
                jsx("div", { key: "row2", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("skinLocal") }),
                  jsx("input", { key: "f", ref: vidFileRef, className: "dsc-fileInput", type: "file", accept: "video/*", onChange: pickLocal("video") }),
                  jsx("button", { key: "b", type: "button", className: "dsc-btn", onClick: () => vidFileRef.current && vidFileRef.current.click(), children: t("skinLocal") }),
                ] }),
                slider(t("skinVolume"), "videoVolume", 0, 100, 1, "%"),
                jsx("div", { key: "row3", className: "dsc-row", children: [
                  jsx("label", { key: "label", className: "dsc-check", children: [
                    jsx("input", { key: "box", type: "checkbox", checked: cfg.videoMuted, onChange: (e) => update({ videoMuted: e.target.checked }) }),
                    jsx("span", { key: "text", children: t("skinMuted") }),
                  ] }),
                ] }),
              ] }),
              jsx("div", { key: "fx", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("skinEffects") }),
                !cfg.imageUrl && !cfg.videoUrl ? jsx("div", { key: "hint", className: "dsc-hint", children: t("skinNoBgHint") }) : null,
                slider(t("skinBlur"), "blur", 0, 40, 1, "px"),
                slider(t("skinOpacity"), "opacity", 0, 100, 1, "%"),
                slider(t("skinScale"), "scale", -100, 100, 1, ""),
              ] }),
              jsx("div", { key: "fl", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("skinFilters") }),
                slider(t("skinBrightness"), "brightness", 50, 150, 1, "%"),
                slider(t("skinContrast"), "contrast", 50, 150, 1, "%"),
                slider(t("skinSaturate"), "saturate", 0, 200, 1, "%"),
                jsx("div", { key: "actions", className: "dsc-cardActions", children: [
                  jsx("button", { key: "reset", type: "button", className: "dsc-btn", onClick: () => update({ brightness: 100, contrast: 100, saturate: 100 }), children: t("skinFilterReset") }),
                ] }),
              ] }),
              jsx("div", { key: "chat", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("chatBgTitle") }),
                jsx("div", { key: "enable", className: "dsc-row", children: [
                  jsx("span", { key: "label", className: "dsc-rowLabel", children: t("chatBgEnable") }),
                  jsx("label", { key: "switch", className: "dsc-switch", children: [
                    jsx("input", { key: "box", type: "checkbox", checked: Boolean(cfg.inputBg && cfg.inputBg.enabled), onChange: (e) => inputUpdate({ enabled: e.target.checked }) }),
                    jsx("span", { key: "track", className: "dsc-switchTrack", children: jsx("span", { className: "dsc-switchThumb" }) }),
                  ] }),
                ] }),
                jsx("div", { key: "row1", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("skinUrl") }),
                  jsx("input", {
                    key: "i",
                    className: "dsc-textInput",
                    type: "text",
                    placeholder: "https://…",
                    value: (cfg.inputBg && cfg.inputBg.imageUrl) || "",
                    onChange: (e) => inputUpdate({ imageUrl: e.target.value }),
                  }),
                ] }),
                jsx("div", { key: "row2", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("skinLocal") }),
                  jsx("input", { key: "f", className: "dsc-fileInput", type: "file", accept: "image/*", onChange: inputPickLocal }),
                  jsx("button", { key: "b", type: "button", className: "dsc-btn", onClick: (e) => { const input = e.currentTarget.previousElementSibling; if (input) input.click(); }, children: t("skinLocal") }),
                  jsx("button", { key: "c", type: "button", className: "dsc-btn", onClick: () => inputUpdate({ imageUrl: "" }), children: t("skinClearBg") }),
                ] }),
                jsx("div", { key: "mode", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("chatBgMode") }),
                  ["fill", "fit", "stretch", "repeat", "center", "cross"].map((m) =>
                    jsx("button", {
                      key: m,
                      type: "button",
                      className: "dsc-chip" + ((cfg.inputBg && cfg.inputBg.mode || "fill") === m ? " dsc-chipOn" : ""),
                      onClick: () => inputUpdate({ mode: m }),
                      children: t("chatBgMode" + m.charAt(0).toUpperCase() + m.slice(1)),
                    })),
                ] }),
                jsx("div", { key: "preview", ref: previewRef, className: "dsc-bgPreview", onMouseDown: onPreviewDown, title: t("chatBgDragHint"), children: [
                  jsx("div", {
                    key: "img",
                    className: "dsc-bgPreviewImg",
                    style: {
                      backgroundImage: (cfg.inputBg && cfg.inputBg.imageUrl) ? `url("${cssUrlEscape(cfg.inputBg.imageUrl)}")` : "none",
                      backgroundSize: previewBgSize(cfg.inputBg),
                      backgroundRepeat: (cfg.inputBg && cfg.inputBg.mode === "repeat") ? "repeat" : "no-repeat",
                      backgroundPosition: (cfg.inputBg && cfg.inputBg.mode === "center") ? "center" : `${(cfg.inputBg && cfg.inputBg.posX) ?? 50}% ${(cfg.inputBg && cfg.inputBg.posY) ?? 50}%`,
                      WebkitMaskImage: previewMask(cfg.inputBg),
                      maskImage: previewMask(cfg.inputBg),
                    },
                  }),
                ] }),
                slider(t("chatBgTransition"), "transition", 10, 90, 1, "%", "inputBg"),
                slider(t("chatBgPosX"), "posX", 0, 100, 1, "%", "inputBg"),
                slider(t("chatBgPosY"), "posY", 0, 100, 1, "%", "inputBg"),
                slider(t("chatBgBlur"), "blur", 0, 40, 1, "px", "inputBg"),
                slider(t("chatBgOpacity"), "opacity", 0, 100, 1, "%", "inputBg"),
                slider(t("skinScale"), "scale", -100, 100, 1, "", "inputBg"),
              ] }),
              jsx("div", { key: "inputCard", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("inputOpacityTitle") }),
                slider(t("chatBgInputOpacity"), "inputOpacity", 0, 100, 1, "%", "inputBg"),
              ] }),
              jsx("div", { key: "pop", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("popBgTitle") }),
                jsx("div", { key: "hint", className: "dsc-hint", children: t("popBgHint") }),
                slider(t("popBgAlpha"), "alpha", 0, 100, 1, "%", "popBg"),
                slider(t("popBgBlur"), "blur", 0, 40, 1, "px", "popBg"),
                slider(t("popBgGrain"), "grain", 0, 100, 1, "%", "popBg"),
                jsx("div", { key: "actions", className: "dsc-cardActions", children: [
                  jsx("button", { key: "reset", type: "button", className: "dsc-btn", onClick: () => update({ popBg: { alpha: 40, blur: 10, grain: 5 } }), children: t("popBgReset") }),
                ] }),
              ] }),
              jsx("div", { key: "inputBox", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("inputBoxTitle") }),
                jsx("div", { key: "row1", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("inputBoxBg") }),
                  jsx("input", {
                    key: "c",
                    type: "color",
                    className: "dsc-colorInput",
                    value: (cfg.inputBox && cfg.inputBox.bgColor) || "#f9fafb",
                    onChange: (e) => inputBoxUpdate({ bgColor: e.target.value }),
                  }),
                  jsx("span", { key: "v", className: "dsc-rangeVal", children: (cfg.inputBox && cfg.inputBox.bgColor) || t("chatColorDefault") }),
                ] }),
                jsx("div", { key: "row2", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("inputBoxText") }),
                  jsx("input", {
                    key: "c",
                    type: "color",
                    className: "dsc-colorInput",
                    value: (cfg.inputBox && cfg.inputBox.textColor) || "#1c1c1e",
                    onChange: (e) => inputBoxUpdate({ textColor: e.target.value }),
                  }),
                  jsx("span", { key: "v", className: "dsc-rangeVal", children: (cfg.inputBox && cfg.inputBox.textColor) || t("chatColorDefault") }),
                ] }),
                jsx("div", { key: "row3", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("inputBoxOpacity") }),
                  jsx("input", { key: "r", type: "range", className: "dsc-range", min: 0, max: 100, step: 1, value: (cfg.inputBox && cfg.inputBox.opacity) ?? 100, onChange: (e) => inputBoxUpdate({ opacity: Number(e.target.value) }) }),
                  jsx("span", { key: "v", className: "dsc-rangeVal", children: String((cfg.inputBox && cfg.inputBox.opacity) ?? 100) + "%" }),
                ] }),
                jsx("div", { key: "row4", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("inputBoxBlur") }),
                  jsx("input", { key: "r", type: "range", className: "dsc-range", min: 0, max: 40, step: 1, value: (cfg.inputBox && cfg.inputBox.blur) || 0, onChange: (e) => inputBoxUpdate({ blur: Number(e.target.value) }) }),
                  jsx("span", { key: "v", className: "dsc-rangeVal", children: String((cfg.inputBox && cfg.inputBox.blur) || 0) + "px" }),
                ] }),
                jsx("div", { key: "actions", className: "dsc-cardActions", children: [
                  jsx("button", { key: "reset", type: "button", className: "dsc-btn", onClick: () => inputBoxUpdate({ bgColor: "", textColor: "", opacity: 100, blur: 0 }), children: t("chatColorReset") }),
                ] }),
              ] }),
              jsx("div", { key: "chatColor", className: "dsc-group", children: [
                jsx("div", { key: "title", className: "dsc-groupTitle", children: t("chatColorTitle") }),
                jsx("div", { key: "row", className: "dsc-row", children: [
                  jsx("span", { key: "l", className: "dsc-rowLabel", children: t("chatColorLabel") }),
                  jsx("input", {
                    key: "c",
                    type: "color",
                    className: "dsc-colorInput",
                    value: cfg.chatColor || "#f9fafb",
                    onChange: (e) => update({ chatColor: e.target.value }),
                  }),
                  jsx("span", { key: "v", className: "dsc-rangeVal", children: cfg.chatColor || t("chatColorDefault") }),
                  jsx("button", { key: "r", type: "button", className: "dsc-btn", onClick: () => update({ chatColor: "" }), children: t("chatColorReset") }),
                ] }),
              ] }),
              jsx("div", { key: "actions", className: "dsc-cardActions", children: [
                jsx("button", { key: "reset", type: "button", className: "dsc-btn dsc-btnDanger", onClick: reset, children: t("skinReset") }),
              ] }),
            ] }),
          ] }),
        ] }) : null,
      ] });
    }

    /* ------------------------------------------------------------------ *
     * Community panel
     * ------------------------------------------------------------------ */
    function CommunityPanel(props) {
      const t = props.t || pickT();
      const [open, setOpen] = React.useState(false);
      return jsx(Fragment, { children: [
        jsx("button", {
          key: "entry",
          type: "button",
          className: "dsc-footerButton" + (props.wide ? "" : " dsc-footerButtonIcon"),
          "aria-label": t("open"),
          title: t("open"),
          onClick: () => setOpen(true),
          children: [
            jsx("svg", { key: "icon", width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: jsx("path", { d: "M8 1.5a2.2 2.2 0 0 0-2.2 2.2V5H4.5A1.5 1.5 0 0 0 3 6.5v6A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 11.5 5h-1.3V3.7A2.2 2.2 0 0 0 8 1.5Zm-1 2.2a1 1 0 0 1 2 0V5H7V3.7Z", fill: "currentColor" }) }),
            props.wide ? jsx("span", { key: "label", className: "dsc-footerLabel", children: t("title") }) : null,
          ],
        }),
        open ? jsx(Browser, { key: "browser", t, onClose: () => setOpen(false) }) : null,
      ] });
    }

    function Browser({ t, onClose }) {
      const [rows, setRows] = React.useState(null);
      const [installed, setInstalled] = React.useState({});
      const [servedBy, setServedBy] = React.useState("");
      const [error, setError] = React.useState(null);
      const [query, setQuery] = React.useState("");
      const [filter, setFilter] = React.useState("all");
      const [busy, setBusy] = React.useState({});
      const [notice, setNotice] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [loadingMore, setLoadingMore] = React.useState(false);
      const [total, setTotal] = React.useState(0);
      const [sources, setSources] = React.useState([]);
      const [source, setSource] = React.useState("auto");
      const [sourceOpen, setSourceOpen] = React.useState(false);
      const sourceWrapRef = React.useRef(null);
      const [autoUpd, setAutoUpd] = React.useState(true);
      const [checking, setChecking] = React.useState(false);
      const [installDir, setInstallDir] = React.useState("");
      const [dirEditing, setDirEditing] = React.useState(false);
      const [dirInput, setDirInput] = React.useState("");
      const alive = React.useRef(true);
      const sourceRef = React.useRef("auto");
      const pageRef = React.useRef(1);
      const settingsRef = React.useRef("");

      const pickSource = (s) => {
        sourceRef.current = s;
        setSource(s);
        try { window.localStorage.setItem("dsc.source", s); } catch { /* ignore */ }
      };

      // Close the source dropdown on outside click.
      React.useEffect(() => {
        if (!sourceOpen) return undefined;
        const onDown = (e) => {
          if (sourceWrapRef.current && !sourceWrapRef.current.contains(e.target)) setSourceOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
      }, [sourceOpen]);

      const load = React.useCallback(async (chosenSource, append = false) => {
        const s = chosenSource !== undefined ? chosenSource : sourceRef.current;
        const p = append ? pageRef.current + 1 : 1;
        if (append) setLoadingMore(true);
        else { setError(null); setLoading(true); }
        try {
          const [list, inst] = await Promise.all([
            api("/community/list?per_page=100&page=" + p + "&source=" + encodeURIComponent(s)),
            api("/community/installed"),
          ]);
          if (!alive.current) return;
          setRows((prev) => (append ? [...(prev || []), ...(list.rows || [])] : (list.rows || [])));
          setTotal(list.total || 0);
          pageRef.current = p;
          setServedBy(list.servedBy || "");
          const map = {};
          for (const item of inst || []) {
            map[item.key] = item;
            if (!map[item.repo]) map[item.repo] = item; // repo-level fallback for the list rows
          }
          setInstalled(map);
          if (settingsRef.current) {
            setInstallDir(settingsRef.current);
            setDirInput(settingsRef.current);
          }
        } catch (e) {
          if (alive.current) setError(e.message);
        } finally {
          if (alive.current) {
            if (append) setLoadingMore(false);
            else setLoading(false);
          }
        }
      }, []);

      React.useEffect(() => {
        alive.current = true;
        api("/community/sources").then((list) => {
          if (!alive.current) return;
          setSources(list || []);
        }).catch(() => { /* keep the built-in list */ });
        api("/community/settings").then((s) => {
          if (!alive.current || !s) return;
          if (s.pluginsDir) {
            settingsRef.current = s.pluginsDir;
            setInstallDir(s.pluginsDir);
            setDirInput(s.pluginsDir);
          }
          if (typeof s.autoUpdate === "boolean") setAutoUpd(s.autoUpdate);
        }).catch(() => { /* keep defaults */ });
        try {
          const saved = window.localStorage.getItem("dsc.source");
          if (saved) pickSource(saved);
        } catch { /* ignore */ }
        load();
        return () => { alive.current = false; };
      }, [load]);

      const run = async (repo, action, successMessage) => {
        setBusy((b) => ({ ...b, [repo]: true }));
        setNotice(null);
        try {
          const result = await action(repo);
          if (result && result.hasClient && successMessage) {
            setNotice(t("installedHint"));
          } else {
            setNotice(result && result.message ? result.message : successMessage);
          }
          await load();
        } catch (e) {
          setNotice(String(e.message || e));
        } finally {
          setBusy((b) => { const next = { ...b }; delete next[repo]; return next; });
        }
      };

      const visible = (rows || []).filter((row) => {
        if (filter === "installed" && !installed[row.repo]) return false;
        if (filter === "available" && installed[row.repo]) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (row.repo + " " + (row.description || "")).toLowerCase().includes(q);
      });

      /** Check GitHub for updates on every installed plugin (safe sync). */
      const updateAll = async () => {
        setChecking(true);
        setNotice(null);
        try {
          const res = await fetch("/community/auto-update", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ force: true }),
          }).then((r) => r.json());
          const results = res && res.results ? res.results : [];
          const updated = results.filter((r) => r.status === "updated");
          const failed = results.filter((r) => r.status === "failed");
          if (updated.length > 0) {
            setNotice(t("updateAllDone") + updated.length + "：" + updated.map((u) => u.repo).join("、") + " —— " + t("needsRestartHint"));
          } else if (failed.length > 0) {
            setNotice(t("updateAllFail") + failed.length + "：" + failed.map((f) => f.repo).join("、"));
          } else if (res && res.skipped) {
            setNotice(t("updateAllSkipped"));
          } else {
            setNotice(t("updateAllOk"));
          }
          await load();
        } catch (e) {
          setNotice(String(e.message || e));
        } finally {
          setChecking(false);
        }
      };

      const toggleAutoUpdate = async (on) => {
        setAutoUpd(on);
        try {
          await post("/community/settings", { autoUpdate: on });
        } catch { /* revert on failure */ setAutoUpd(!on); }
      };

      return jsxs(Fragment, { children: [
        jsx("div", { key: "backdrop", className: "dsc-backdrop", onClick: onClose }),
        jsx("div", { key: "drawer", className: "dsc-drawer", children: [
          jsx("div", { key: "head", className: "dsc-head", children: [
            jsx("span", { key: "title", className: "dsc-title", children: t("title") }),
            jsx("button", { key: "close", type: "button", className: "dsc-close", "aria-label": t("close"), onClick: onClose, children: "×" }),
          ] }),
          jsx("div", { key: "toolbar", className: "dsc-toolbar", children: [
            jsx("input", {
              key: "search",
              className: "dsc-search",
              type: "text",
              placeholder: t("search"),
              value: query,
              onChange: (e) => setQuery(e.target.value),
            }),
            jsx("button", { key: "refresh", type: "button", className: "dsc-btn", onClick: load, disabled: loading, children: t("refresh") }),
          ] }),
          jsx("div", { key: "status", className: "dsc-status", children: [
            jsx("span", { key: "mirror", children: [t("mirror") + ": ", servedBy || "—"] }),
            jsx("div", { key: "srcWrap", ref: sourceWrapRef, className: "dsc-sourceWrap", children: [
              jsx("button", {
                key: "btn",
                type: "button",
                className: "dsc-sourceSelect dsc-sourceBtn",
                title: t("mirror"),
                onClick: () => setSourceOpen(!sourceOpen),
                children: sourceLabel((sources.length > 0 ? sources : FALLBACK_SOURCES).find((s) => s.key === source) ?? { key: source }),
              }),
              sourceOpen ? jsx("div", { key: "list", className: "dsc-sourceList", children:
                (sources.length > 0 ? sources : FALLBACK_SOURCES).map((s) =>
                  jsx("button", {
                    key: s.key,
                    type: "button",
                    className: "dsc-sourceItem" + (s.key === source ? " dsc-chipOn" : ""),
                    onClick: () => { pickSource(s.key); load(s.key); setSourceOpen(false); },
                    children: sourceLabel(s),
                  }),
                ),
              }) : null,
            ] }),
            jsx("a", { key: "gh", className: "dsc-link", href: "https://github.com/topics/dsh-plugin", target: "_blank", rel: "noreferrer", children: t("github") }),
          ] }),
          notice ? jsx("div", { key: "notice", className: "dsc-notice", children: [
            jsx("span", { key: "text", children: notice }),
            notice === t("installedHint")
              ? jsx("span", { key: "hint", className: "dsc-badge", children: t("needsRestartHint") })
              : null,
          ] }) : null,
          jsx("div", { key: "chips", className: "dsc-toolbar", children: [
            jsx("button", { key: "all", type: "button", className: "dsc-chip" + (filter === "all" ? " dsc-chipOn" : ""), onClick: () => setFilter("all"), children: t("all") }),
            jsx("button", { key: "installed", type: "button", className: "dsc-chip" + (filter === "installed" ? " dsc-chipOn" : ""), onClick: () => setFilter("installed"), children: t("onlyInstalled") }),
            jsx("button", { key: "available", type: "button", className: "dsc-chip" + (filter === "available" ? " dsc-chipOn" : ""), onClick: () => setFilter("available"), children: t("onlyAvailable") }),
            jsx("button", { key: "update", type: "button", className: "dsc-btn", disabled: checking, onClick: updateAll, children: checking ? [jsx("span", { key: "s", className: "dsc-spin" }), " ", t("updateAllBusy")] : t("updateAll") }),
            jsx("label", { key: "autoupd", className: "dsc-check", children: [
              jsx("input", { key: "box", type: "checkbox", checked: autoUpd, onChange: (e) => toggleAutoUpdate(e.target.checked) }),
              jsx("span", { key: "text", children: t("autoUpdateToggle") }),
            ] }),
          ] }),
          jsx("div", { key: "body", className: "dsc-body", children: [
            loading
              ? jsx("div", { key: "loading", className: "dsc-empty", children: jsx("span", { className: "dsc-spin" }) })
              : error
                ? jsx("div", { key: "error", className: "dsc-error", children: [
                    jsx("div", { key: "text", children: [t("error") + " " + error] }),
                    jsx("button", { key: "retry", type: "button", className: "dsc-btn", onClick: load, children: t("retry") }),
                  ] })
                : visible.length === 0
                  ? jsx("div", { key: "empty", className: "dsc-empty", children: t("empty") })
                  : jsxs(Fragment, { children: [
                      visible.map((row) => card(row, t, installed, busy, run, sourceRef.current)),
                      rows && rows.length < total && rows.length < 1000
                        ? jsx("div", { key: "more", className: "dsc-moreRow", children: [
                            jsx("button", {
                              type: "button",
                              className: "dsc-btn",
                              disabled: loadingMore,
                              onClick: () => load(undefined, true),
                              children: loadingMore ? [jsx("span", { key: "s", className: "dsc-spin" }), " ", t("loading")] : t("loadMore"),
                            }),
                          ] })
                        : null,
                    ] }),
          ] }),
          jsx("div", { key: "foot", className: "dsc-foot", children: [
            jsx("div", { key: "dir", className: "dsc-dirRow", children: [
              jsx("span", { key: "label", children: [t("installDir") + ": "] }),
              dirEditing
                ? jsxs(Fragment, { children: [
                    jsx("input", {
                      key: "input",
                      className: "dsc-dirInput",
                      type: "text",
                      value: dirInput,
                      placeholder: t("dirPlaceholder"),
                      onChange: (e) => setDirInput(e.target.value),
                      onKeyDown: (e) => { if (e.key === "Enter") e.target.nextSibling?.click?.(); },
                    }),
                    jsx("button", {
                      key: "save",
                      type: "button",
                      className: "dsc-btn dsc-btnPrimary",
                      onClick: async () => {
                        try {
                          const res = await post("/community/settings", { pluginsDir: dirInput.trim() });
                          setInstallDir(res.pluginsDir || dirInput.trim());
                          setDirEditing(false);
                          setNotice(t("dirSaved"));
                        } catch (e) {
                          setNotice(String(e.message || e));
                        }
                      },
                      children: t("saveDir"),
                    }),
                    jsx("button", { key: "cancel", type: "button", className: "dsc-btn", onClick: () => { setDirInput(installDir); setDirEditing(false); }, children: t("cancelDir") }),
                  ] })
                : jsxs(Fragment, { children: [
                    jsx("span", { key: "path", className: "dsc-dirPath", title: installDir, children: installDir || "—" }),
                    jsx("button", { key: "change", type: "button", className: "dsc-btn", onClick: () => { setDirInput(installDir); setDirEditing(true); }, children: t("changeDir") }),
                  ] }),
            ] }),
            jsx("span", { key: "count", children: [t("shown") + ": ", rows ? rows.length : 0, " / ", total || "—"] }),
          ] }),
        ] }),
      ] });
    }

    function card(row, t, installed, busy, run, currentSource) {
      const inst = installed[row.repo];
      const isBusy = busy[row.repo];
      const src = currentSource && currentSource !== "auto" ? currentSource : undefined;
      return jsx("div", {
        key: row.repo,
        className: "dsc-card",
        children: [
          jsx("div", { key: "head", className: "dsc-cardHead", children: [
            jsx("span", { key: "name", className: "dsc-cardName", title: row.repo, children: row.repo }),
            inst
              ? jsx("span", { key: "inst", className: "dsc-badge dsc-badgeInstalled", children: inst.enabled === false ? t("installedDisabled") : t("installed") })
              : null,
            row.isBundle ? jsx("span", { key: "bundle", className: "dsc-badge", children: t("bundle") }) : null,
            row.hasClient ? jsx("span", { key: "client", className: "dsc-badge", children: t("client") }) : null,
            jsx("span", { key: "stars", className: "dsc-badge", children: [t("stars"), " ", row.stars] }),
          ] }),
          row.description ? jsx("p", { key: "desc", className: "dsc-cardDesc", children: row.description }) : null,
          jsx("div", { key: "meta", className: "dsc-cardMeta", children: [
            row.url ? jsx("a", { key: "repo", className: "dsc-link", href: row.url, target: "_blank", rel: "noreferrer", children: t("repoLink") }) : null,
            row.language ? jsx("span", { key: "lang", children: row.language }) : null,
            row.updatedAt ? jsx("span", { key: "updated", children: [t("updated"), " ", String(row.updatedAt).slice(0, 10)] }) : null,
            !row.isPlugin ? jsx("span", { key: "nopkg", children: t("noPackage") }) : null,
          ] }),
          jsx("div", { key: "actions", className: "dsc-cardActions", children: [
            !inst
              ? jsx("button", {
                  key: "install",
                  type: "button",
                  className: "dsc-btn dsc-btnPrimary",
                  disabled: isBusy || !row.isPlugin,
                  onClick: () => run(row.repo, (repo) => post("/community/install", { repo, source: src }), t("installed")),
                  children: isBusy ? [jsx("span", { key: "s", className: "dsc-spin" }), " ", t("installing")] : t("install"),
                })
              : null,
            inst && inst.enabled === false
              ? jsx("button", { key: "enable", type: "button", className: "dsc-btn", disabled: isBusy, onClick: () => run(row.repo, (repo) => post("/community/set-enabled", { repo, enabled: true }), t("enable")), children: t("enable") })
              : inst
                ? jsx("button", { key: "disable", type: "button", className: "dsc-btn", disabled: isBusy, onClick: () => run(row.repo, (repo) => post("/community/set-enabled", { repo, enabled: false }), t("disable")), children: t("disable") })
                : null,
            inst
              ? jsx("button", {
                  key: "update",
                  type: "button",
                  className: "dsc-btn",
                  disabled: isBusy,
                  onClick: () => run(row.repo, (repo) => post("/community/update", { repo, source: src }), t("updatedOk")),
                  children: isBusy ? [jsx("span", { key: "s", className: "dsc-spin" }), " ", t("updating")] : t("update"),
                })
              : null,
            inst
              ? jsx("button", {
                  key: "uninstall",
                  type: "button",
                  className: "dsc-btn dsc-btnDanger",
                  disabled: isBusy,
                  onClick: () => {
                    if (typeof window !== "undefined" && window.confirm(t("confirmUninstall"))) {
                      run(row.repo, (repo) => post("/community/uninstall", { repo }), t("uninstalled"));
                    }
                  },
                  children: t("uninstall"),
                })
              : null,
          ] }),
        ],
      });
    }

    /* ------------------------------------------------------------------ *
     * Plugin contract
     * ------------------------------------------------------------------ */
    const inject = ["slots", "locale"];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "community-plugins: dictionaries");
      const t = ctx.locale.bind(NS);
      // Skin entry registers first so it sits above the community entry.
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action",
        id: "skin-panel",
        locale: NS,
      }, SkinPanel));
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action",
        id: "community-panel",
        locale: NS,
      }, CommunityPanel));
      ctx.effect(() => initSkin(), "custom-skin: apply persisted skin");
      ctx.effect(() => autoUpdateAtBoot(), "community: background GitHub sync at boot");
      void t;
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
