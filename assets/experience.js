import { matchingProducts, availableValues } from "./catalog-model.js";

(() => {
  "use strict";
  const assetBase = new URL(".", import.meta.url);
  const load = (name) =>
    fetch(new URL(name, assetBase)).then((r) => {
      if (!r.ok) throw new Error("Could not load information");
      return r.json();
    });
  const normalize = (s) =>
    String(s || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const terms = (s) => normalize(s).split(" ").filter(Boolean);
  const node = (tag, text, attrs = {}) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const save = (text, name) => {
    const url = URL.createObjectURL(
        new Blob([text], {
          type: "text/plain;charset=utf-8",
        }),
      ),
      a = node("a", "", {
        href: url,
        download: name,
      });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const catalog = document.getElementById("catalog-filters");
  if (catalog) {
    const search = document.getElementById("product-search"),
      category = document.getElementById("product-category"),
      style = document.getElementById("product-style"),
      material = document.getElementById("product-material");
    const cards = [...document.querySelectorAll("[data-product]")],
      status = document.getElementById("catalog-status"),
      tray = document.getElementById("compare-tray"),
      panel = document.getElementById("comparison"),
      table = document.getElementById("comparison-table");
    const selected = new Set();
    let page = 1,
      data = new Map(),
      matches = [];
    const pageSize = 12;
    const announce = (text) => {
      status.hidden = false;
      status.textContent = text;
    };
    // Normalize card text once, rather than on every keystroke for every item.
    const products = cards.map((card) => ({
      card,
      category: card.dataset.category,
      style: card.dataset.style,
      material: card.dataset.material,
      searchText: normalize(card.textContent),
    }));
    const updateFacets = () => {
      for (const [select, property, label] of [
        [style, "style", "Any style"],
        [material, "material", "Any material"],
      ]) {
        const values = availableValues(products, category.value, property);
        const previous = select.value;
        select.replaceChildren(
          new Option(label, ""),
          ...values.map((value) => new Option(value, value)),
        );
        select.value = values.includes(previous) ? previous : "";
        select.closest(".field").hidden = values.length === 0;
      }
    };
    const filter = (reset = true) => {
      if (reset) page = 1;
      matches = matchingProducts(products, {
        category: category.value,
        style: style.value,
        material: material.value,
        words: terms(search.value),
      }).map((product) => product.card);
      const url = new URL(location.href);
      for (const [key, value] of [
        ["category", category.value],
        ["style", style.value],
        ["material", material.value],
        ["q", search.value.trim()],
      ]) {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      }
      history.replaceState(null, "", url);
      const pages = Math.max(1, Math.ceil(matches.length / pageSize));
      page = Math.min(page, pages);
      cards.forEach((c) => (c.hidden = true));
      matches
        .slice((page - 1) * pageSize, page * pageSize)
        .forEach((c) => (c.hidden = false));
      document.getElementById("product-count").textContent =
        `${matches.length} matching product${matches.length === 1 ? "" : "s"}`;
      document.getElementById("product-empty").hidden = matches.length > 0;
      document.getElementById("product-pagination").hidden = pages <= 1;
      document.getElementById("product-page").textContent =
        `Page ${page} of ${pages}`;
      document.getElementById("products-prev").disabled = page === 1;
      document.getElementById("products-next").disabled = page === pages;
    };
    const query = new URLSearchParams(location.search);
    if ([...category.options].some((x) => x.value === query.get("category")))
      category.value = query.get("category");
    search.value = (query.get("q") || "").slice(0, 150);
    updateFacets();
    for (const [select, key] of [
      [style, "style"],
      [material, "material"],
    ]) {
      if ([...select.options].some((option) => option.value === query.get(key)))
        select.value = query.get(key);
    }
    filter();
    catalog.addEventListener("submit", (e) => e.preventDefault());
    category.addEventListener("change", () => {
      updateFacets();
      filter();
    });
    [style, material].forEach((el) =>
      el.addEventListener("change", () => filter()),
    );
    search.addEventListener("input", () => filter());
    catalog.addEventListener("reset", () =>
      setTimeout(() => {
        updateFacets();
        filter();
      }, 0),
    );
    document
      .getElementById("reset-empty-products")
      .addEventListener("click", () => {
        catalog.reset();
        search.focus();
      });
    document.getElementById("products-prev").addEventListener("click", () => {
      page--;
      filter(false);
      catalog.scrollIntoView({
        block: "start",
      });
    });
    document.getElementById("products-next").addEventListener("click", () => {
      page++;
      filter(false);
      catalog.scrollIntoView({
        block: "start",
      });
    });
    const updateTray = () => {
      tray.hidden = !selected.size;
      document.getElementById("compare-count").textContent =
        `${selected.size} of 3 products selected`;
      document.getElementById("show-comparison").disabled = !data.size;
    };
    const selectedItems = () =>
      [...selected].map((id) => data.get(id)).filter(Boolean);
    const renderComparison = () => {
      const items = selectedItems();
      if (!items.length) {
        panel.hidden = true;
        return;
      }
      table.replaceChildren();
      const caption = node("caption", "Comparison of your selected products", {
          class: "live-region",
        }),
        thead = node("thead"),
        head = node("tr");
      head.append(
        node("th", "Product", {
          scope: "col",
        }),
      );
      items.forEach((p) => {
        const th = node("th", undefined, {
          scope: "col",
        });
        th.append(
          node("a", p.title + " " + (p.model || ""), {
            href: p.path,
          }),
        );
        head.append(th);
      });
      thead.append(head);
      const tbody = node("tbody");
      const properties = [
        ...new Set([
          "Category",
          ...items.flatMap((p) => p.properties.map((x) => x.name)),
        ]),
      ];
      properties.forEach((key) => {
        const row = node("tr");
        row.append(
          node("th", key, {
            scope: "row",
          }),
        );
        items.forEach((p) => {
          let v =
            key === "Category"
              ? p.category
              : p.properties.find((x) => x.name === key)?.value || "Not listed";
          if (v === "Y") v = "Yes";
          if (v === "N") v = "No";
          row.append(node("td", v));
        });
        tbody.append(row);
      });
      table.append(caption, thead, tbody);
      const same = items.every((p) => p.category === items[0].category),
        category = items[0].category;
      const service =
        same && category === "Residential doors"
          ? "residential-new"
          : same && category === "Gate operators"
            ? "gate"
            : same && ["Openers", "Residential accessories"].includes(category)
              ? "accessory"
              : same && category.startsWith("Commercial")
                ? "commercial-new"
                : "other";
      document.getElementById("request-shortlist").href =
        "contact.html?service=" +
        service +
        "&issue=" +
        encodeURIComponent(
          "My product shortlist: " +
            items.map((p) => p.title + " " + (p.model || "")).join("; ") +
            ". Please help me compare fit, options, and availability.",
        );
      panel.hidden = false;
    };
    document.querySelectorAll("[data-compare]").forEach((box) =>
      box.addEventListener("change", () => {
        if (box.checked && selected.size >= 3) {
          box.checked = false;
          announce(
            "Choose up to three products. Uncheck one to select another.",
          );
          return;
        }
        if (box.checked) selected.add(box.dataset.compare);
        else selected.delete(box.dataset.compare);
        updateTray();
        if (!panel.hidden) renderComparison();
      }),
    );
    document.getElementById("show-comparison").addEventListener("click", () => {
      renderComparison();
      document.getElementById("comparison-title").focus();
      panel.scrollIntoView({
        block: "start",
      });
    });
    document
      .getElementById("close-comparison")
      .addEventListener("click", () => {
        panel.hidden = true;
        document.getElementById("show-comparison").focus();
      });
    document
      .getElementById("clear-comparison")
      .addEventListener("click", () => {
        selected.clear();
        document
          .querySelectorAll("[data-compare]")
          .forEach((c) => (c.checked = false));
        panel.hidden = true;
        updateTray();
        status.hidden = true;
      });
    document
      .getElementById("download-shortlist")
      .addEventListener("click", () => {
        save(
          "OVERHEAD DOOR COMPANY OF AMARILLO — PRODUCT SHORTLIST\n\n" +
            selectedItems()
              .map(
                (p) =>
                  p.title +
                  " " +
                  (p.model || "") +
                  "\n" +
                  new URL(p.path, location.href).href +
                  "\n" +
                  p.properties.map((v) => v.name + ": " + v.value).join("\n"),
              )
              .join("\n\n") +
            "\n\nConfirm availability, configuration, ratings, and fit with our team.\n806-372-5884\ncody@odcamarillo.com",
          "garage-door-product-shortlist.txt",
        );
        announce(
          "Shortlist downloaded. Attach it to your request email if helpful.",
        );
      });
    load("product-catalog.json")
      .then((items) => {
        data = new Map(items.map((p) => [p.id, p]));
        updateTray();
      })
      .catch(() => {
        document
          .querySelectorAll("[data-compare]")
          .forEach((c) => (c.disabled = true));
        announce(
          "Comparison is temporarily unavailable. Product pages and filters still work; call us to compare options.",
        );
      });
  }
  const siteSearch = document.getElementById("site-search-input");
  if (siteSearch) {
    const results = document.getElementById("site-results"),
      count = document.getElementById("site-result-count"),
      kind = document.getElementById("search-kind");
    let index = [],
      page = 1,
      matches = [];
    const pageSize = 20;
    siteSearch.value = (
      new URLSearchParams(location.search).get("q") || ""
    ).slice(0, 150);
    const render = (reset = true) => {
      if (reset) page = 1;
      const words = terms(siteSearch.value);
      matches = index.filter(
        (d) =>
          (!kind.value || d.type === kind.value) &&
          (words.length
            ? words.every((t) => normalize(d.title + " " + d.text).includes(t))
            : Boolean(kind.value) || d.type === "Page"),
      );
      matches.sort((a, b) => {
        const rank = (d) =>
          words.reduce(
            (n, w) => n + (normalize(d.title).includes(w) ? 5 : 0),
            0,
          ) + (d.type === "Page" ? 1 : 0);
        return rank(b) - rank(a);
      });
      const pages = Math.max(1, Math.ceil(matches.length / pageSize));
      page = Math.min(page, pages);
      results.replaceChildren();
      matches.slice((page - 1) * pageSize, page * pageSize).forEach((d) => {
        const a = node("a", undefined, {
          href: d.path,
        });
        a.append(
          node("span", d.type, {
            class: "result-kind",
          }),
          node("h2", d.title),
          node("p", d.description),
        );
        results.append(a);
      });
      count.textContent = words.length
        ? `${matches.length} matching results`
        : "Browse the website, or enter a search above.";
      if (!matches.length)
        results.append(
          node(
            "p",
            "No matches. Try a shorter model number, “warranty,” or “service.” You can also call 806-372-5884.",
          ),
        );
      document.getElementById("search-pagination").hidden = pages <= 1;
      document.getElementById("search-page").textContent =
        `Page ${page} of ${pages}`;
      document.getElementById("search-prev").disabled = page === 1;
      document.getElementById("search-next").disabled = page === pages;
    };
    siteSearch.closest("form").addEventListener("submit", (e) => {
      if (!index.length) return;
      e.preventDefault();
      const url = new URL(location.href);
      if (siteSearch.value) url.searchParams.set("q", siteSearch.value);
      else url.searchParams.delete("q");
      history.replaceState(null, "", url);
      render();
    });
    kind.addEventListener("change", () => render());
    document.getElementById("search-prev").addEventListener("click", () => {
      page--;
      render(false);
      results.scrollIntoView({
        block: "start",
      });
    });
    document.getElementById("search-next").addEventListener("click", () => {
      page++;
      render(false);
      results.scrollIntoView({
        block: "start",
      });
    });
    load("search-index.json")
      .then((items) => {
        index = items;
        render();
      })
      .catch(() => {
        count.textContent =
          "Search is temporarily unavailable. Use these shortcuts or call the team.";
      });
  }
  const decision = document.getElementById("repair-decision");
  if (decision)
    decision.addEventListener("submit", (event) => {
      event.preventDefault();
      const condition = new FormData(decision).get("condition"),
        unsafe = new FormData(decision).get("unsafe") === "yes",
        result = document.getElementById("decision-result");
      const advice = unsafe
        ? [
            "Stop using the door and request service.",
            "Keep people and vehicles clear. Do not disconnect, force, or repeatedly operate the door. A technician needs to assess the complete system.",
            "repair",
            "Describe the door’s condition",
          ]
        : condition === "upgrade"
          ? [
              "Compare replacement options.",
              "Start with the style, insulation, windows, and features you want. The team can assess the existing system and explain the complete installed options.",
              "residential-new",
              "Discuss a new door",
            ]
          : condition === "damage"
            ? [
                "Ask about repair and section availability.",
                "A matching section may be possible, but model, condition, compatibility, and damage determine whether repair or replacement makes sense.",
                "repair",
                "Ask about section damage",
              ]
            : condition === "worn"
              ? [
                  "Compare repair and replacement together.",
                  "Share the repair history and any recurring problems. Ask for an inspection and an explanation of both options before deciding.",
                  "repair",
                  "Request an assessment",
                ]
              : [
                  "Start with a service assessment.",
                  "Describe what changed, which controls still work, and the door’s current position. A technician can identify the cause and discuss repair or replacement if needed.",
                  "repair",
                  "Request service",
                ];
      result.replaceChildren(
        node("h2", advice[0]),
        node("p", advice[1]),
        node("a", advice[3], {
          class: "btn btn-dark",
          href:
            "contact.html?service=" +
            advice[2] +
            "&issue=" +
            encodeURIComponent(
              "Repair or replace guidance: " +
                condition +
                (unsafe ? "; possible unsafe door condition." : "."),
            ),
        }),
      );
      result.hidden = false;
    });
  const programTask = document.getElementById("program-task");
  if (programTask) {
    const model = document.getElementById("program-model"),
      guidance = document.getElementById("program-guidance"),
      list = document.getElementById("program-docs"),
      count = document.getElementById("program-count");
    let docs = [];
    const guidanceText = {
      remote: [
        "Match the remote and the opener.",
        "Check the model and battery first. Identify the radio system and use the exact pairing sequence in the matching instructions. Clearing memory can remove other paired controls.",
      ],
      keypad: [
        "Match the keypad model before choosing a PIN procedure.",
        "OKP2, OUK, OKP-BX, and OWK-BX are different products. Use the model instructions below. You never need to share your PIN with us.",
      ],
      vehicle: [
        "Check both the vehicle and opener instructions.",
        "HomeLink steps depend on the vehicle make/year and opener generation. Some combinations need additional compatible hardware. Use the opener manual alongside the vehicle’s HomeLink instructions.",
      ],
      wifi: [
        "Check compatibility before changing settings.",
        "Identify the opener and any OHD Anywhere accessory, then use the matching setup or compatibility document. Describe any error without sharing passwords.",
      ],
    };
    const render = () => {
      const task = programTask.value,
        [title, text] = guidanceText[task];
      guidance.replaceChildren(node("h2", title), node("p", text));
      const words = terms(model.value);
      let matches = docs.filter((d) =>
        ["Owner manual", "Programming instructions", "Planning guide"].includes(
          d.category,
        ),
      );
      const pattern =
        task === "keypad"
          ? /keypad|ouk|okp|owk/i
          : task === "wifi"
            ? /anywhere|wifi|wi fi|compatib/i
            : task === "vehicle"
              ? /homelink|odyssey|destiny|legacy|opener/i
              : /remote|transmitter|odyssey|destiny|legacy|infinity|opener|o[1234][bt]/i;
      matches = matches.filter(
        (d) =>
          pattern.test(d.title + " " + d.tags) &&
          words.every((w) => normalize(d.title + " " + d.tags).includes(w)),
      );
      matches.sort(
        (a, b) =>
          (a.category === "Programming instructions" ? -1 : 0) -
          (b.category === "Programming instructions" ? -1 : 0),
      );
      list.replaceChildren();
      matches.slice(0, 24).forEach((d) => {
        const a = node("a", undefined, {
          href: d.path,
          target: "_blank",
          rel: "noopener",
        });
        a.append(
          node("strong", d.title),
          node("span", d.category + " · " + d.format),
        );
        list.append(a);
      });
      count.textContent = `${matches.length} matching documents${matches.length > 24 ? " · showing the first 24; narrow by model for more precise results." : ""}`;
      if (!matches.length)
        list.append(
          node(
            "p",
            "No exact match in this collection. Try a shorter model name or ask our team with a safely taken label photo.",
          ),
        );
    };
    programTask.addEventListener("change", render);
    model.addEventListener("input", render);
    render();
    load("resource-catalog.json")
      .then((items) => {
        docs = items;
        render();
      })
      .catch(() => {
        count.textContent =
          "The document list is temporarily unavailable. Use all owner manuals or contact the team.";
      });
  }
})();
