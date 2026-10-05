(() => {
  "use strict";

  const C = window.MX || {};
  const SAMPLE = window.MX_SAMPLE_CARS || [];
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- helpers ----------
  // Build DOM with textContent only, so nothing from the database is ever parsed as HTML.
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
  }

  const normReg = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prettyReg = (r) => {
    const n = normReg(r);
    const m = n.match(/^(K[A-Z]{2})(\d{3}[A-Z])$/);
    return m ? `${m[1]} ${m[2]}` : n;
  };
  const kes = (n) => "KES " + Number(n || 0).toLocaleString("en-KE");
  const safeUrl = (u) => (/^https:\/\//i.test(u || "") ? u : null);
  const tiktokId = (u) => {
    const m = String(u || "").match(/\/video\/(\d{8,25})/);
    return m ? m[1] : null;
  };
  const waLink = (text) => `https://wa.me/${C.WHATSAPP}?text=${encodeURIComponent(text)}`;
  const sbReady = () => Boolean(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  const sbHeaders = (extra = {}) => ({
    apikey: C.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${C.SUPABASE_ANON_KEY}`,
    ...extra,
  });
  const title = (c) => `${c.year} ${c.make} ${c.model}`;

  const normalize = (c) => ({
    ...c,
    reg: normReg(c.reg),
    price: Number(c.price) || 0,
    photos: Array.isArray(c.photos) ? c.photos.map(safeUrl).filter(Boolean) : [],
  });

  // ---------- data ----------
  async function loadCars() {
    if (!sbReady()) return { cars: SAMPLE.map(normalize), demo: true };
    const r = await fetch(
      `${C.SUPABASE_URL}/rest/v1/cars?status=eq.published&order=created_at.desc&select=*`,
      { headers: sbHeaders() }
    );
    if (!r.ok) throw new Error("load failed");
    return { cars: (await r.json()).map(normalize), demo: false };
  }

  async function loadCar(reg) {
    if (!sbReady()) {
      const c = SAMPLE.map(normalize).find((x) => x.reg === reg);
      return c ? { car: c, demo: true } : { car: null, demo: true };
    }
    const r = await fetch(
      `${C.SUPABASE_URL}/rest/v1/cars?reg=eq.${encodeURIComponent(reg)}&status=eq.published&select=*&limit=1`,
      { headers: sbHeaders() }
    );
    if (!r.ok) throw new Error("load failed");
    const rows = await r.json();
    return { car: rows[0] ? normalize(rows[0]) : null, demo: false };
  }

  // ---------- shared UI ----------
  function badges(car) {
    const out = [];
    out.push(
      car.logbook_status === "clear"
        ? h("span", { class: "badge ok", text: "Logbook CLEAR" })
        : h("span", { class: "badge pending", text: "Logbook check pending" })
    );
    out.push(
      car.owner_verified
        ? h("span", { class: "badge ok", text: "Owner verified" })
        : h("span", { class: "badge pending", text: "Owner not yet verified" })
    );
    if (car.tims_checked) out.push(h("span", { class: "badge ok", text: "TIMS search done" }));
    out.push(h("span", { class: "badge loc", text: `Location: ${car.town}` }));
    return h("div", { class: "badges" }, out);
  }

  function placeholder(car) {
    return h("div", { class: "ph", "aria-hidden": "true" },
      h("img", { class: "ph-car", src: "/img/logo-car.png", alt: "" }),
      h("span", { text: car.make })
    );
  }

  function carCard(car) {
    const img = car.photos[0]
      ? h("img", { src: car.photos[0], alt: title(car), loading: "lazy" })
      : placeholder(car);
    return h(
      "a",
      { class: "card", href: `/c/${car.reg}` },
      img,
      h(
        "div",
        { class: "card-body" },
        h("h3", { class: "card-title", text: title(car) }),
        h("div", { class: "price", text: kes(car.price) }),
        h("div", { class: "meta", text: `${car.town}${car.mileage_km ? " · " + Number(car.mileage_km).toLocaleString("en-KE") + " km" : ""}` }),
        badges(car)
      )
    );
  }

  function videoTile(car, id) {
    const tile = h("div", { class: "vtile" });
    const btn = h(
      "button",
      {
        class: "vplay",
        type: "button",
        "aria-label": `Play video of ${title(car)}`,
        onclick: () => {
          btn.hidden = true;
          tile.prepend(
            h("iframe", {
              class: "vframe",
              src: `https://www.tiktok.com/embed/v2/${id}`,
              allow: "fullscreen",
              loading: "lazy",
              title: `${title(car)} on TikTok`,
            })
          );
        },
      },
      h("span", { class: "vicon", text: "▶" }),
      h("strong", { text: title(car) }),
      h("span", { text: `${car.town} · ${kes(car.price)}` })
    );
    tile.append(btn);
    return tile;
  }

  // ---------- home ----------
  const RANGES = {
    all: [0, Infinity],
    u500: [0, 500000],
    "500-1m": [500000, 1000000],
    "1-2m": [1000000, 2000000],
    "2m+": [2000000, Infinity],
  };

  async function initHome() {
    const grid = $("#grid");
    const status = $("#status");
    let data;
    try {
      data = await loadCars();
    } catch {
      status.textContent = "Could not load cars. Check your connection and refresh.";
      return;
    }
    status.textContent = "";
    if (data.demo) $("#demo-banner").hidden = false;

    // Video strip
    const withVideo = data.cars.filter((c) => tiktokId(c.tiktok_url));
    if (withVideo.length) {
      $("#videos").hidden = false;
      $("#vstrip").replaceChildren(...withVideo.map((c) => videoTile(c, tiktokId(c.tiktok_url))));
    }

    // Filters
    const state = { town: "All", budget: "all", q: "" };
    const towns = ["All", ...new Set([...(C.TOWNS || []), ...data.cars.map((c) => c.town)])];
    const chips = $("#chips");

    function drawChips() {
      chips.replaceChildren(
        ...towns.map((t) =>
          h("button", {
            class: "chip", type: "button", text: t,
            "aria-pressed": String(state.town === t),
            onclick: () => { state.town = t; drawChips(); drawGrid(); },
          })
        )
      );
    }

    function drawGrid() {
      const [lo, hi] = RANGES[state.budget];
      const q = state.q.trim().toLowerCase();
      const qReg = normReg(q);
      const list = data.cars.filter(
        (c) =>
          (state.town === "All" || c.town === state.town) &&
          c.price >= lo && c.price < hi &&
          (!q || title(c).toLowerCase().includes(q) || (qReg && c.reg.includes(qReg)))
      );
      $("#count").textContent = `${list.length} car${list.length === 1 ? "" : "s"}`;
      if (!list.length) {
        grid.replaceChildren(h("p", { class: "empty", text: "No cars match. Try another town or budget." }));
      } else {
        grid.replaceChildren(...list.map(carCard));
      }
    }

    $("#budget").addEventListener("change", (e) => { state.budget = e.target.value; drawGrid(); });
    $("#q").addEventListener("input", (e) => { state.q = e.target.value; drawGrid(); });
    drawChips();
    drawGrid();
  }

  // ---------- car page ----------
  function regFromLocation() {
    const q = new URLSearchParams(location.search).get("reg");
    if (q) return normReg(q);
    const m = location.pathname.match(/\/c\/([^/]+)\/?$/);
    return m ? normReg(decodeURIComponent(m[1])) : "";
  }

  function carNotFound(root) {
    root.replaceChildren(
      h("div", { class: "panel" },
        h("h1", { text: "Car not found" }),
        h("p", { text: "This listing may have been sold or removed." }),
        h("a", { class: "btn btn-primary", href: "/", text: "See all cars" })
      )
    );
  }

  async function initCar() {
    const root = $("#car-root");
    const reg = regFromLocation();
    if (!reg) return carNotFound(root);

    let res;
    try {
      res = await loadCar(reg);
    } catch {
      root.replaceChildren(h("p", { class: "notice error", text: "Could not load this car. Check your connection and refresh." }));
      return;
    }
    const car = res.car;
    if (!car) return carNotFound(root);
    if (res.demo) $("#demo-banner").hidden = false;

    document.title = `${title(car)} · ${kes(car.price)} · ${car.town} | ${C.BRAND}`;
    const desc = $('meta[name="description"]');
    if (desc) desc.content = `${title(car)} in ${car.town} for ${kes(car.price)}. Book a viewing on WhatsApp.`;

    // Media column
    const media = h("div", { class: "media" });
    const gallery = h("div", { class: "gallery", "aria-label": "Photos" },
      car.photos.length
        ? car.photos.map((p, i) => h("img", { src: p, alt: `${title(car)} photo ${i + 1}`, loading: i ? "lazy" : "eager" }))
        : [placeholder(car)]
    );
    media.append(gallery);
    const vid = tiktokId(car.tiktok_url);
    if (vid) {
      media.append(
        h("div", { class: "section" },
          h("h2", { text: "Walkaround video" }),
          h("div", { class: "video-wrap" },
            h("iframe", {
              class: "vframe", src: `https://www.tiktok.com/embed/v2/${vid}`,
              allow: "fullscreen", loading: "lazy", title: `${title(car)} on TikTok`,
            })
          )
        )
      );
    }

    // Details panel
    const spec = (k, v) => (v ? [h("dt", { text: k }), h("dd", { text: v })] : []);
    const bookText = `Hi ${C.BRAND}, I'd like to book a viewing for the ${title(car)} (${prettyReg(car.reg)}) listed at ${kes(car.price)} in ${car.town}.`;
    const timsText = `Hi ${C.BRAND}, please do a TIMS search for ${prettyReg(car.reg)} (${title(car)}). I understand the fee is ${kes(C.TIMS_SEARCH_FEE)}.`;

    const shareBtn = h("button", {
      class: "btn btn-ghost", type: "button", text: "Share this car",
      onclick: async () => {
        const url = location.href;
        try {
          if (navigator.share) await navigator.share({ title: title(car), url });
          else { await navigator.clipboard.writeText(url); shareBtn.textContent = "Link copied"; }
        } catch { /* user cancelled */ }
      },
    });

    const panel = h("div", { class: "panel" },
      h("div", {}, h("span", { class: "reg", text: prettyReg(car.reg) })),
      h("h1", { text: title(car) }),
      h("div", { class: "price", text: kes(car.price) }),
      badges(car),
      h("dl", { class: "specs" },
        spec("Mileage", car.mileage_km ? `${Number(car.mileage_km).toLocaleString("en-KE")} km` : ""),
        spec("Transmission", car.transmission),
        spec("Fuel", car.fuel),
        spec("Viewing point", car.meeting_point)
      ),
      car.description ? h("p", { text: car.description }) : null,
      h("div", { class: "actions" },
        h("a", { class: "btn btn-wa btn-block", href: waLink(bookText), target: "_blank", rel: "noopener", text: "Book Viewing on WhatsApp" }),
        h("a", { class: "btn btn-primary btn-block", href: waLink(timsText), target: "_blank", rel: "noopener", text: `Ask for TIMS Search (${kes(C.TIMS_SEARCH_FEE)})` }),
        shareBtn
      ),
      h("p", { class: "small", text: `Viewings happen at a public petrol station. Never send a deposit to anyone before you have seen the car and the logbook. Delivery to another town from about ${kes(C.DELIVERY_FROM)}, ask on WhatsApp.` })
    );

    root.replaceChildren(media, panel);
  }

  // ---------- sell page ----------
  const MAX_FILE = 5 * 1024 * 1024;
  const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

  async function sbUpload(bucket, path, file) {
    const r = await fetch(`${C.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: sbHeaders({ "Content-Type": file.type, "x-upsert": "false" }),
      body: file,
    });
    if (!r.ok) throw new Error("upload failed");
  }

  function initSell() {
    const form = $("#sell-form");
    const msg = $("#form-msg");
    const sel = $("#town");
    const towns = C.TOWNS || [];
    sel.replaceChildren(
      h("option", { value: "", text: "Select town" }),
      ...towns.map((t) => h("option", { value: t, text: t })),
      h("option", { value: "Other", text: "Other" })
    );

    const show = (cls, text) => { msg.className = "notice " + cls; msg.textContent = text; msg.hidden = false; };
    const ext = (f) => (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.hidden = true;
      const fd = new FormData(form);
      if (fd.get("website")) return; // honeypot

      const name = String(fd.get("name") || "").trim();
      const reg = normReg(fd.get("reg"));
      const price = parseInt(String(fd.get("price") || "").replace(/[^\d]/g, ""), 10);
      const town = String(fd.get("town") || "");
      let phone = String(fd.get("phone") || "").replace(/[\s+()-]/g, "");
      const logbook = fd.get("logbook");
      const idDoc = fd.get("idcard");

      if (name.length < 2) return show("error", "Please enter your full name.");
      if (!/^(?:254|0)?[17]\d{8}$/.test(phone)) return show("error", "Enter a valid Kenyan phone number, e.g. 0712 345 678.");
      phone = "254" + phone.replace(/^(?:254|0)/, "");
      if (!/^K[A-Z]{2}\d{3}[A-Z]$/.test(reg)) return show("error", "Enter a valid registration, e.g. KBZ 123X.");
      if (!price || price < 50000) return show("error", "Enter the asking price in KES.");
      if (!town) return show("error", "Select the town where the car is.");

      const files = sbReady() ? [logbook, idDoc] : [];
      if (sbReady()) {
        for (const f of files) {
          if (!f || !f.size) return show("error", "Please attach both the logbook and your ID.");
          if (!OK_TYPES.includes(f.type)) return show("error", "Files must be JPG, PNG, WebP or PDF.");
          if (f.size > MAX_FILE) return show("error", "Each file must be under 5 MB.");
        }
      }

      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Sending...";

      try {
        if (sbReady()) {
          const folder = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const logbookPath = `${folder}/logbook.${ext(logbook)}`;
          const idPath = `${folder}/id.${ext(idDoc)}`;
          await sbUpload("seller-docs", logbookPath, logbook);
          await sbUpload("seller-docs", idPath, idDoc);
          const r = await fetch(`${C.SUPABASE_URL}/rest/v1/seller_submissions`, {
            method: "POST",
            headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
            body: JSON.stringify({
              name, phone, reg, price, town,
              logbook_path: logbookPath, id_path: idPath, consent: true,
            }),
          });
          if (!r.ok) throw new Error("insert failed");
          form.replaceChildren(
            h("div", { class: "notice success" },
              h("strong", { text: "Received. " }),
              `We will WhatsApp you on ${phone} after we review ${prettyReg(reg)}.`
            ),
            h("a", { class: "btn btn-ghost", href: "/", text: "Back to cars" })
          );
        } else {
          // Demo mode: no database yet, hand the details to WhatsApp instead.
          const text = `Hi ${C.BRAND}, I want to sell my car.\nName: ${name}\nPhone: ${phone}\nReg: ${prettyReg(reg)}\nPrice: ${kes(price)}\nTown: ${town}\nI authorize you to market it. I will send the logbook and my ID here.`;
          window.open(waLink(text), "_blank", "noopener");
          show("success", "WhatsApp opened with your details. Send your logbook and ID photos in that chat.");
          btn.disabled = false;
          btn.textContent = "Submit car";
        }
      } catch {
        show("error", "Something went wrong sending your details. Please try again, or contact us on WhatsApp.");
        btn.disabled = false;
        btn.textContent = "Submit car";
      }
    });
  }

  // ---------- light / dark toggle (dark is the brand default) ----------
  function initTheme() {
    const btn = $("#theme");
    if (!btn) return;
    const root = document.documentElement;
    const sync = () => {
      const label = root.dataset.theme === "light" ? "Switch to dark mode" : "Switch to light mode";
      btn.setAttribute("aria-label", label);
      btn.title = label;
    };
    sync();
    btn.addEventListener("click", () => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      if (next === "light") root.dataset.theme = "light";
      else delete root.dataset.theme;
      try { localStorage.setItem("mx-theme", next); } catch { /* private mode */ }
      sync();
    });
  }
  initTheme();

  // ---------- install button + service worker ----------
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const b = $("#install");
    if (b) b.hidden = false;
  });
  document.addEventListener("click", async (e) => {
    if (e.target.id !== "install" || !deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    e.target.hidden = true;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  const page = document.body.dataset.page;
  if (page === "home") initHome();
  else if (page === "car") initCar();
  else if (page === "sell") initSell();
})();
