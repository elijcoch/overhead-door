(() => {
  "use strict";
  const saveFile = (blob, name) => {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const catalogPromise = fetch("assets/resource-catalog.json").then((r) => {
    if (!r.ok) throw new Error("Catalog unavailable");
    return r.json();
  });
  const formatSize = (n) =>
    n >= 1048576
      ? `${(n / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(n / 1024))} KB`;
  const normalize = (s) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");
  const initLibrary = async (root) => {
    const docs = await catalogPromise,
      byId = new Map(docs.map((d) => [d.id, d]));
    const rows = [...root.querySelectorAll("[data-document]")],
      search = root.querySelector("[data-doc-search]"),
      category = root.querySelector("[data-doc-category]"),
      format = root.querySelector("[data-doc-format]");
    const count = root.querySelector("[data-doc-count]"),
      empty = root.querySelector("[data-doc-empty]"),
      pagination = root.querySelector("[data-doc-pagination]"),
      pageLabel = root.querySelector("[data-doc-page]");
    const prev = root.querySelector("[data-doc-prev]"),
      next = root.querySelector("[data-doc-next]"),
      pack = root.querySelector("[data-pack]"),
      packCount = root.querySelector("[data-pack-count]"),
      status = root.querySelector("[data-doc-status]"),
      download = root.querySelector("[data-download-pack]");
    const selected = new Set();
    let page = 1,
      busy = false;
    const pageSize = 24;
    const params = new URLSearchParams(location.search);
    search.value = (params.get("q") || "").slice(0, 150);
    const preset = params.get("category");
    if (preset && [...category.options].some((o) => o.value === preset))
      category.value = preset;
    const searchable = new Map(
      docs.map((doc) => [
        doc.id,
        normalize(
          `${doc.title} ${doc.tags || ""} ${doc.category} ${doc.format}`,
        ),
      ]),
    );
    const updateFormats = () => {
      const previous = format.value;
      const values = [
        ...new Set(
          rows
            .map((row) => byId.get(row.dataset.document))
            .filter(
              (doc) =>
                doc && (!category.value || doc.category === category.value),
            )
            .map((doc) => doc.format),
        ),
      ].sort();
      format.replaceChildren(
        new Option("All formats", ""),
        ...values.map((value) => new Option(value, value)),
      );
      format.value = values.includes(previous) ? previous : "";
      format.closest(".field").hidden = values.length < 2;
      category.closest(".field").hidden = category.options.length < 3;
    };
    updateFormats();
    const showStatus = (text) => {
      status.hidden = false;
      status.textContent = text;
    };
    const filter = (reset) => {
      if (reset) page = 1;
      const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
      const matches = rows.filter((row) => {
        const doc = byId.get(row.dataset.document);
        if (!doc) return false;
        const text = searchable.get(doc.id);
        return (
          (!category.value || doc.category === category.value) &&
          (!format.value || doc.format === format.value) &&
          terms.every((term) => text.includes(term))
        );
      });
      const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
      page = Math.min(page, pageCount);
      rows.forEach((row) => (row.hidden = true));
      matches
        .slice((page - 1) * pageSize, page * pageSize)
        .forEach((row) => (row.hidden = false));
      count.textContent = `${matches.length} matching document${matches.length === 1 ? "" : "s"}`;
      empty.hidden = matches.length > 0;
      pagination.hidden = pageCount < 2;
      prev.disabled = page === 1;
      next.disabled = page === pageCount;
      pageLabel.textContent = `Page ${page} of ${pageCount}`;
      root.querySelector("[data-clear-filters]").hidden =
        !search.value && !category.value && !format.value;
    };
    const updatePack = () => {
      let bytes = 0;
      selected.forEach((id) => (bytes += byId.get(id)?.bytes || 0));
      pack.hidden = selected.size === 0;
      packCount.textContent = `${selected.size} selected · ${formatSize(bytes)}`;
      download.disabled = busy || bytes > 25 * 1048576;
      download.title =
        bytes > 25 * 1048576
          ? "Choose a smaller group (up to 25 MB), or download large files individually."
          : "";
    };
    search.addEventListener("input", () => filter(true));
    category.addEventListener("change", () => {
      updateFormats();
      filter(true);
    });
    format.addEventListener("change", () => filter(true));
    root.querySelector("[data-clear-filters]").addEventListener("click", () => {
      search.value = "";
      category.value = "";
      format.value = "";
      updateFormats();
      filter(true);
      search.focus();
    });
    prev.addEventListener("click", () => {
      page--;
      filter(false);
      root.querySelector(".document-list").scrollIntoView({
        block: "start",
      });
    });
    next.addEventListener("click", () => {
      page++;
      filter(false);
      root.querySelector(".document-list").scrollIntoView({
        block: "start",
      });
    });
    root.querySelectorAll("[data-pick]").forEach((input) =>
      input.addEventListener("change", () => {
        if (input.checked) selected.add(input.dataset.pick);
        else selected.delete(input.dataset.pick);
        updatePack();
      }),
    );
    root.querySelector("[data-clear-pack]").addEventListener("click", () => {
      selected.clear();
      root
        .querySelectorAll("[data-pick]")
        .forEach((input) => (input.checked = false));
      updatePack();
    });
    download.addEventListener("click", async () => {
      if (busy || !selected.size) return;
      busy = true;
      updatePack();
      download.textContent = "Preparing ZIP…";
      try {
        const files = [];
        let bytes = 0;
        for (const id of selected) {
          const doc = byId.get(id);
          showStatus(
            `Preparing ${files.length + 1} of ${selected.size}: ${doc.title}`,
          );
          const response = await fetch(doc.path);
          if (!response.ok) throw new Error(`Could not load ${doc.title}`);
          const data = new Uint8Array(await response.arrayBuffer());
          bytes += data.length;
          if (bytes > 25 * 1048576)
            throw new Error(
              "This selection is larger than 25 MB. Download the files individually or select fewer documents.",
            );
          files.push({
            name: doc.path.split("/").pop(),
            data,
          });
        }
        const readme = new TextEncoder().encode(
          "Overhead Door Company of Amarillo — manufacturer document package\n\n" +
            [...selected]
              .map((id) => {
                const d = byId.get(id);
                return `${d.title}\n${new URL(d.path, location.href).href}`;
              })
              .join("\n\n") +
            "\n\nManufacturer documents remain unmodified. Confirm the product, revision and project applicability before use.\n",
        );
        files.push({
          name: "DOCUMENT-INDEX.txt",
          data: readme,
        });
        saveFile(makeZip(files), "overhead-door-documents.zip");
        showStatus(
          `ZIP ready: ${selected.size} original documents and an index.`,
        );
      } catch (error) {
        showStatus(
          `${error.message}. Your selection is still available; you can use the individual Download links.`,
        );
      } finally {
        busy = false;
        download.textContent = "Download selected ZIP";
        updatePack();
      }
    });
    filter(true);
  };
  // Minimal ZIP STORE encoder: no external library, file contents are kept unchanged.
  const crcTable = Uint32Array.from(
    {
      length: 256,
    },
    (_, n) => {
      for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
      return n >>> 0;
    },
  );
  const crc32 = (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  function makeZip(files) {
    const chunks = [],
      central = [];
    let offset = 0,
      centralSize = 0;
    for (const file of files) {
      const name = new TextEncoder().encode(file.name),
        crc = crc32(file.data);
      const local = new Uint8Array(30 + name.length),
        lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x800, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0x21, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, file.data.length, true);
      lv.setUint32(22, file.data.length, true);
      lv.setUint16(26, name.length, true);
      local.set(name, 30);
      chunks.push(local, file.data);
      const header = new Uint8Array(46 + name.length),
        cv = new DataView(header.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x800, true);
      cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, file.data.length, true);
      cv.setUint32(24, file.data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      header.set(name, 46);
      central.push(header);
      centralSize += header.length;
      offset += local.length + file.data.length;
    }
    const end = new Uint8Array(22),
      ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end], {
      type: "application/zip",
    });
  }
  const support = document.getElementById("support-symptom");
  if (support)
    catalogPromise
      .then((docs) => {
        const model = document.getElementById("support-model"),
          answer = document.getElementById("support-answer"),
          list = document.getElementById("support-docs");
        const tips = {
          remote: [
            "Remote or opener control?",
            [
              "If the wall button operates the door normally, start with the remote’s battery and the model’s pairing instructions.",
              "Check your owner manual for any lock or vacation setting that changes remote operation.",
              "Use the exact model instructions before clearing codes; doing so may remove other paired controls.",
            ],
          ],
          keypad: [
            "Start with the keypad and its model.",
            [
              "Check the keypad battery and the manual for that keypad’s indicator behavior.",
              "The keypad and opener generation determine the pairing method. Use the matching local manual.",
              "If the model is unknown, send the team a safely taken photo of the label or keypad.",
            ],
          ],
          power: [
            "Check what still responds.",
            [
              "Note whether the wall button, remote, lights, and keypad respond at all.",
              "If there is no sign of power, check your home’s normal power controls only if safe and familiar. Do not open electrical covers or use damaged wiring.",
              "Ask for service if power is present but the equipment remains unresponsive.",
            ],
          ],
          reverse: [
            "Keep the opening clear.",
            [
              "From a safe location, check for an obvious object blocking the opening or sensor line.",
              "If the door is damaged, uneven, or off track, stop operating it and request service.",
              "Use the manual for sensor indicators and troubleshooting. Do not bypass sensors or adjust spring tension or force settings to make a problem disappear.",
            ],
          ],
          motor: [
            "Stop testing the door.",
            [
              "A running motor with no door movement needs the door and drive system checked.",
              "If there is a loose cable, crooked door, or possible spring problem, keep clear.",
              "Do not disconnect, force, or repeatedly operate a damaged door. Request professional service.",
            ],
          ],
          connected: [
            "Identify the opener and connection system.",
            [
              "Use the exact model manual to identify supported smart-access hardware.",
              "Have the opener model and the name of the app or accessory ready. Do not include passwords in a service request.",
              "For setup problems, describe whether local controls still work and when the connection stopped.",
            ],
          ],
        };
        const update = () => {
          const [title, items] = tips[support.value];
          answer.replaceChildren();
          const h = document.createElement("h3");
          h.textContent = title;
          const ul = document.createElement("ul");
          items.forEach((text) => {
            const li = document.createElement("li");
            li.textContent = text;
            ul.append(li);
          });
          answer.append(h, ul);
          let manuals = docs.filter((d) => d.category === "Owner manual");
          if (model.value) {
            const terms = normalize(model.value).split(" ");
            manuals = manuals.filter((d) =>
              ["Odyssey Destiny", "RHX RSX CDX"].includes(model.value)
                ? terms.some((term) => normalize(d.title).includes(term))
                : terms.every((term) => normalize(d.title).includes(term)),
            );
          } else
            manuals = manuals.filter((d) =>
              /opener|odyssey|destiny|legacy|infinity|overdrive|phantom|python|rhx|rsx/i.test(
                d.title,
              ),
            );
          list.replaceChildren();
          manuals.forEach((d) => {
            const p = document.createElement("p"),
              a = document.createElement("a");
            a.href = d.path;
            a.target = "_blank";
            a.rel = "noopener";
            a.textContent = d.title;
            p.append(a);
            list.append(p);
          });
          if (!manuals.length) {
            const p = document.createElement("p");
            p.textContent =
              "No exact matching manual in this collection. Browse all owner manuals or ask the team with the model number.";
            list.append(p);
          }
        };
        support.addEventListener("change", update);
        model.addEventListener("change", update);
        update();
      })
      .catch(() => {
        /* Static manual links remain available. */
      });
  const planner = document.getElementById("project-planner");
  if (planner) {
    const diagram = document.getElementById("opening-diagram"),
      summary = document.getElementById("opening-summary"),
      status = document.getElementById("planner-status");
    const svgNode = (name, attrs, text) => {
      const e = document.createElementNS("http://www.w3.org/2000/svg", name);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (text) e.textContent = text;
      return e;
    };
    const dimensions = () => ({
      w: Number(planner.elements.namedItem("Opening width (inches)").value),
      h: Number(planner.elements.namedItem("Opening height (inches)").value),
    });
    const validDims = ({ w, h }) =>
      Number.isFinite(w) &&
      Number.isFinite(h) &&
      w >= 12 &&
      h >= 12 &&
      w <= 1200 &&
      h <= 1200;
    const footInch = (n) =>
      `${Math.floor(n / 12)} ft ${(n % 12).toFixed(2).replace(/\.?0+$/, "") || 0} in`;
    const update = () => {
      const d = dimensions();
      if (!validDims(d)) {
        summary.textContent =
          "Enter width and height between 12 and 1,200 inches to update the concept.";
        return;
      }
      const scale = Math.min(320 / d.w, 220 / d.h),
        w = d.w * scale,
        h = d.h * scale,
        x = (500 - w) / 2,
        y = (300 - h) / 2;
      diagram.replaceChildren();
      diagram.append(
        svgNode("rect", {
          x,
          y,
          width: w,
          height: h,
          fill: "#edf1e7",
          stroke: "#718265",
          "stroke-width": 2,
        }),
      );
      for (let n = 1; n < 4; n++)
        diagram.append(
          svgNode("line", {
            x1: x,
            y1: y + (n * h) / 4,
            x2: x + w,
            y2: y + (n * h) / 4,
            stroke: "#a6b59a",
            "stroke-width": 1,
          }),
        );
      diagram.append(
        svgNode("line", {
          x1: x,
          y1: y + h + 25,
          x2: x + w,
          y2: y + h + 25,
          stroke: "#b82730",
          "stroke-width": 1,
        }),
      );
      diagram.append(
        svgNode(
          "text",
          {
            x: 250,
            y: y + h + 47,
            "text-anchor": "middle",
            fill: "#283822",
            "font-size": 13,
            stroke: "none",
          },
          `Width: ${d.w} in (${footInch(d.w)})`,
        ),
      );
      diagram.append(
        svgNode(
          "text",
          {
            x: 250,
            y: 335,
            "text-anchor": "middle",
            fill: "#283822",
            "font-size": 13,
            stroke: "none",
          },
          `Height: ${d.h} in (${footInch(d.h)})`,
        ),
      );
      diagram.append(
        svgNode(
          "text",
          {
            x: 250,
            y: 20,
            "text-anchor": "middle",
            fill: "#6d7b61",
            "font-size": 10,
            stroke: "none",
          },
          "PRELIMINARY OPENING CONCEPT — NOT TO SCALE",
        ),
      );
      summary.textContent = `${d.w} × ${d.h} inches. Confirm the opening and clearances with a qualified project team.`;
      const project = planner.elements.namedItem("Project").value.trim();
      document.getElementById("request-project").href =
        "contact.html?service=commercial-new&issue=" +
        encodeURIComponent(
          `Project: ${project || "Opening project"}; opening ${d.w} × ${d.h} inches; model ${planner.elements.namedItem("Product / model").value || "not selected"}. I can attach a project brief.`,
        );
    };
    planner.addEventListener("input", update);
    update();
    planner.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!planner.reportValidity()) return;
      let docs = [];
      try {
        docs = await catalogPromise;
      } catch (_) {}
      const picked = [...document.querySelectorAll("[data-pick]:checked")]
        .map((input) => docs.find((d) => d.id === input.dataset.pick))
        .filter(Boolean);
      const body =
        "PRELIMINARY DOOR OPENING / PROJECT BRIEF\n\n" +
        [...new FormData(planner)]
          .filter(([, v]) => String(v).trim())
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n") +
        "\n\nSELECTED DOCUMENTS\n" +
        (picked
          .map((d) => `${d.title}\n${new URL(d.path, location.href).href}`)
          .join("\n\n") || "No documents selected.") +
        "\n\nThis is a planning record only. It is not an engineered drawing or a confirmation of product fit, loads, clearances, or code compliance. Confirm all project requirements with the manufacturer and qualified project team.";
      saveFile(
        new Blob([body], {
          type: "text/plain;charset=utf-8",
        }),
        "door-project-brief.txt",
      );
      status.hidden = false;
      status.textContent =
        "Project brief downloaded. Attach it to your email when discussing the project with our team.";
    });
    document.getElementById("save-opening").addEventListener("click", () => {
      if (!validDims(dimensions())) {
        status.hidden = false;
        status.textContent =
          "Enter valid opening dimensions before downloading the concept.";
        return;
      }
      const exported = diagram.cloneNode(true);
      exported.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      saveFile(
        new Blob(
          ['<?xml version="1.0" encoding="UTF-8"?>\n' + exported.outerHTML],
          {
            type: "image/svg+xml;charset=utf-8",
          },
        ),
        "opening-concept-not-for-construction.svg",
      );
    });
  }
  document.querySelectorAll("[data-document-library]").forEach((root) =>
    initLibrary(root).catch(() => {
      const status = root.querySelector("[data-doc-status]");
      status.hidden = false;
      status.textContent =
        "Interactive filtering is unavailable. The document links below still work.";
    }),
  );
})();
