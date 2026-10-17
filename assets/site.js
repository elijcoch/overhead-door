/* Small, dependency-free enhancements. The site and contact links work without JavaScript. */
(() => {
  "use strict";
  const menu = document.querySelector(".menu");
  const nav = document.querySelector(".nav-links");
  const closeMenu = () => {
    if (!menu || !nav) return;
    nav.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "Open navigation");
  };
  if (menu && nav) {
    menu.addEventListener("click", () => {
      const open = menu.getAttribute("aria-expanded") !== "true";
      nav.classList.toggle("open", open);
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute(
        "aria-label",
        open ? "Close navigation" : "Open navigation",
      );
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("open")) {
        closeMenu();
        menu.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".header")) closeMenu();
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    matchMedia("(min-width: 821px)").addEventListener("change", (event) => {
      if (event.matches) closeMenu();
    });
  }
  const measurementGuide = document.querySelector(".measurement-guide");
  if (measurementGuide && window.matchMedia("(max-width: 820px)").matches) {
    measurementGuide.removeAttribute("open");
  }
  const updateHours = () => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());
      const time = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      const minutes = Number(time.hour) * 60 + Number(time.minute);
      const open =
        !["Sat", "Sun"].includes(time.weekday) &&
        minutes >= 450 &&
        minutes < 990;
      document.querySelectorAll("[data-hours]").forEach((el) => {
        el.dataset.open = String(open);
        el.textContent = open
          ? "Office open · until 4:30 pm"
          : "Office hours · Mon–Fri, 7:30–4:30";
      });
    } catch (_) {
      /* The published office hours remain available without Intl. */
    }
  };
  updateHours();
  // Keep a tab left open through opening/closing time accurate.
  setInterval(updateHours, 60_000);
  const search = document.querySelector("[data-resource-search]");
  if (search) {
    const items = [...document.querySelectorAll("[data-search]")];
    search.addEventListener("input", () => {
      const terms = search.value
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      let matches = 0;
      items.forEach((item) => {
        item.hidden = !terms.every((term) =>
          item.textContent.toLowerCase().includes(term),
        );
        if (!item.hidden) matches++;
      });
      const empty = document.querySelector("[data-search-empty]");
      if (empty) empty.hidden = matches > 0;
      const count = document.querySelector("[data-search-count]");
      if (count) count.textContent = `${matches} matching resources`;
    });
  }
  const form = document.getElementById("request-form");
  if (!form) return;
  form.noValidate = true;
  const panels = [...form.querySelectorAll("[data-step]")];
  const progress = [...document.querySelectorAll("[data-progress]")];
  const serviceInputs = [...form.querySelectorAll('[name="service"]')];
  const dynamic = document.getElementById("service-details");
  const error = document.getElementById("form-error");
  const status = document.getElementById("form-status");
  let step = 1;
  let activeService = "";
  let ticket = null;
  const labels = {
    repair: "Door repair",
    maintenance: "Preventive maintenance",
    "residential-new": "New Residential Door",
    "commercial-new": "New Commercial Project",
    gate: "Gate or grille",
    accessory: "Opener, remote or keypad",
    unsure: "Help choosing a service",
    other: "Other request",
  };
  // [id, label, kind, options or placeholder]. Unknown values are always valid answers.
  const sharedRepair = [
    [
      "property",
      "Property type",
      "select",
      ["Home", "Business / facility", "Not sure"],
    ],
    [
      "position",
      "Current door position",
      "select",
      ["Closed", "Open", "Partly open", "Crooked / off track", "Not sure"],
    ],
    [
      "impact",
      "What is affected?",
      "select",
      [
        "Normal use is affected",
        "Vehicle is trapped",
        "Building cannot be secured",
        "Business access is blocked",
        "Routine / no immediate issue",
        "Not sure",
      ],
    ],
    [
      "equipment",
      "Equipment brand / model",
      "text",
      "Optional — only if already known",
    ],
    [
      "location",
      "Which door needs attention?",
      "text",
      "e.g. left garage door, loading bay 3",
    ],
    [
      "started",
      "When did it start?",
      "text",
      "e.g. this morning, gradually over a month",
    ],
  ];
  const fields = {
    repair: [
      ...sharedRepair,
      [
        "symptom",
        "What are you noticing?",
        "select",
        [
          "Door will not open",
          "Door will not close",
          "Door moves unevenly",
          "Loud bang / possible broken spring",
          "Loose or broken cable",
          "Damaged panel / impact damage",
          "New grinding or squeaking sound",
          "Not sure / other",
        ],
      ],
    ],
    maintenance: [
      [
        "property",
        "Property type",
        "select",
        ["Home", "Business / facility", "Not sure"],
      ],
      ["count", "Number of doors", "number", "e.g. 2"],
      ["equipment", "Door / opener brand", "text", "Optional"],
      [
        "location",
        "Door locations / asset numbers",
        "text",
        "e.g. bay 1 and bay 2",
      ],
      ["last_service", "Last service, if known", "text", "e.g. last year"],
      [
        "maintenance_issue",
        "Any changes in operation?",
        "text",
        "Noise, uneven movement, wear, or none",
      ],
    ],
    "residential-new": [
      [
        "project",
        "Project type",
        "select",
        [
          "Replace an existing door",
          "New construction",
          "Replace door and opener",
          "Still exploring",
        ],
      ],
      ["count", "Number of doors", "number", "e.g. 1"],
      [
        "style",
        "Preferred style",
        "select",
        [
          "Traditional raised panel",
          "Carriage house / wood look",
          "Modern / glass",
          "Not sure yet",
        ],
      ],
      [
        "insulation",
        "Insulation preference",
        "select",
        ["Insulated", "Non-insulated", "Help me compare"],
      ],
      [
        "opener",
        "Include an opener?",
        "select",
        ["Yes", "No", "Help me decide"],
      ],
      [
        "timeline",
        "Project timing",
        "select",
        [
          "As soon as available",
          "Within a month",
          "1–3 months",
          "Planning / flexible",
        ],
      ],
    ],
    "commercial-new": [
      [
        "business",
        "Business / facility name",
        "text",
        "Facility or project name",
      ],
      [
        "project",
        "Project type",
        "select",
        [
          "New construction",
          "Replacement",
          "Repair / upgrade planning",
          "Not sure",
        ],
      ],
      ["count", "Number of openings", "number", "e.g. 3"],
      [
        "door_type",
        "Door type",
        "select",
        [
          "Sectional overhead door",
          "Rolling / coiling door",
          "Security grille",
          "Fire-rated door",
          "Not sure",
        ],
      ],
      [
        "use",
        "Opening use",
        "text",
        "e.g. loading dock, warehouse, vehicle access",
      ],
      [
        "cycles",
        "Approximate daily use",
        "select",
        [
          "Fewer than 10 cycles",
          "10–50 cycles",
          "More than 50 cycles",
          "Not sure",
        ],
      ],
      [
        "power",
        "Operator / power supply",
        "text",
        "If known — do not inspect electrical equipment",
      ],
      [
        "timeline",
        "Target date or project phase",
        "text",
        "e.g. bidding now, installation in January",
      ],
    ],
    gate: [
      [
        "project",
        "What do you need?",
        "select",
        [
          "Repair an existing system",
          "New gate / grille",
          "Maintenance",
          "Not sure",
        ],
      ],
      [
        "system",
        "System type",
        "select",
        ["Slide gate", "Swing gate", "Security grille", "Not sure"],
      ],
      ["operation", "Operation", "select", ["Powered", "Manual", "Not sure"]],
      [
        "position",
        "Current position",
        "select",
        ["Open", "Closed", "Partly open", "Operating normally", "Not sure"],
      ],
      [
        "leaves",
        "Gate configuration",
        "select",
        [
          "Single leaf / panel",
          "Double leaf / panels",
          "Security grille",
          "Not sure",
        ],
      ],
      ["equipment", "Operator brand / model", "text", "Only if already known"],
      [
        "impact",
        "Access affected",
        "select",
        [
          "No immediate access issue",
          "Entrance cannot be secured",
          "Vehicle / business access blocked",
          "Other",
        ],
      ],
    ],
    accessory: [
      [
        "accessory",
        "Help needed",
        "select",
        [
          "Opener repair",
          "New opener",
          "Remote control",
          "Keypad",
          "Smartphone connectivity",
          "Not sure",
        ],
      ],
      ["equipment", "Opener brand / model", "text", "Only if already known"],
      [
        "response",
        "What still works?",
        "select",
        [
          "Wall button works, remote does not",
          "Remote works, wall button does not",
          "Motor runs but door does not move",
          "Nothing responds",
          "New installation / no issue",
          "Not sure",
        ],
      ],
    ],
    unsure: [],
    other: [],
  };
  const measurementServices = new Set([
    "residential-new",
    "commercial-new",
    "gate",
  ]);
  const createField = ([id, label, kind, options]) => {
    const box = document.createElement("div");
    box.className = "field";
    const labelEl = document.createElement("label");
    labelEl.htmlFor = `detail-${id}`;
    labelEl.textContent = label;
    const input = document.createElement(
      kind === "select" ? "select" : "input",
    );
    input.id = `detail-${id}`;
    input.name = label;
    input.dataset.ticket = label;
    if (kind === "select") {
      input.append(new Option("Choose if known", ""));
      options.forEach((value) => input.append(new Option(value, value)));
    } else {
      input.type = kind === "number" ? "number" : "text";
      input.placeholder = options || "Optional";
      input.maxLength = 100;
      if (kind === "number") {
        input.min = "1";
        input.max = "1000";
        input.inputMode = "numeric";
      }
    }
    box.append(labelEl, input);
    return box;
  };
  const selectedService = () =>
    serviceInputs.find((input) => input.checked)?.value || "";
  const renderDetails = () => {
    const service = selectedService();
    if (service === activeService) return;
    activeService = service;
    dynamic.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = `${labels[service] || "Service"} details`;
    const hint = document.createElement("p");
    hint.textContent =
      "These details help the team prepare. It’s okay to leave anything you don’t know blank.";
    hint.style.fontSize = "12px";
    const grid = document.createElement("div");
    grid.className = "form-grid";
    (fields[service] || []).forEach((field) => grid.append(createField(field)));
    dynamic.append(heading, hint, grid);
    if (measurementServices.has(service)) {
      const details = document.createElement("details");
      details.className = "optional-details";
      const summary = document.createElement("summary");
      summary.textContent = "I already know the opening size (optional)";
      const measureGrid = document.createElement("div");
      measureGrid.className = "form-grid";
      [
        ["width", "Opening width", "text", "e.g. 16 ft 0 in"],
        ["height", "Opening height", "text", "e.g. 7 ft 0 in"],
        ["headroom", "Headroom above opening", "text", "e.g. 14 in, if known"],
        ["sideroom", "Side clearance (left / right)", "text", "If known"],
        ["backroom", "Available depth into garage", "text", "If known"],
      ].forEach((field) => measureGrid.append(createField(field)));
      const measureHint = document.createElement("p");
      measureHint.textContent =
        "Skip this if you’re unsure. Our team will verify the fit; you don’t need to measure to request help.";
      details.append(summary, measureHint, measureGrid);
      dynamic.append(details);
    }
    document.getElementById("request-topic").textContent =
      labels[service] || "Your request";
  };
  const showStep = (next) => {
    step = next;
    panels.forEach((panel) => {
      panel.hidden = Number(panel.dataset.step) !== step;
    });
    progress.forEach((item) => {
      if (Number(item.dataset.progress) === step)
        item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    error.hidden = true;
    status.hidden = true;
    const heading = panels
      .find((panel) => !panel.hidden)
      ?.querySelector("h2,legend");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({
        preventScroll: true,
      });
    }
    if (window.scrollY > form.offsetTop - 90)
      form.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    document.getElementById("step-announcement").textContent =
      `Step ${step} of 3`;
  };
  const email = form.elements.namedItem("Email");
  const contactMethod = form.elements.namedItem("Preferred contact");
  contactMethod.addEventListener("change", () => {
    email.required = contactMethod.value === "Email";
    document.querySelector("[data-email-label]").textContent = email.required
      ? "Email *"
      : "Email (optional)";
  });
  const createTicket = () => {
    const service = selectedService();
    const entries = [...form.querySelectorAll("[data-ticket]")]
      .filter((el) => !el.disabled && String(el.value).trim())
      .map((el) => [el.dataset.ticket, el.value.trim()]);
    const reference =
      ticket?.reference ||
      `OD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Array.from(
        crypto.getRandomValues(new Uint8Array(3)),
        (x) => x.toString(16).padStart(2, "0"),
      )
        .join("")
        .toUpperCase()}`;
    const recipient =
      service === "gate" ? "hoyt@odcamarillo.com" : "cody@odcamarillo.com";
    const name = form.elements.namedItem("Customer name").value.trim();
    const urgent = entries.some(
      ([key, value]) =>
        [
          "Access affected",
          "What is affected?",
          "Current door position",
        ].includes(key) &&
        /trapped|cannot be secured|blocked|Crooked/.test(value),
    );
    const subject = `${urgent ? "[ACCESS / SAFETY ISSUE] " : ""}${labels[service]} | ${form.elements.namedItem("City").value.trim()} | ${name} | ${reference}`;
    const text = `SERVICE REQUEST — ${reference}\nService: ${labels[service]}\n\n${entries.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nPhotos: Attach an overall view and any safely visible model label to this email if available.\n\nRequested times are preferences. Please contact me to confirm availability; no appointment has been booked.`;
    return {
      reference,
      recipient,
      subject,
      text,
      entries,
      service,
    };
  };
  const review = () => {
    ticket = createTicket();
    document.getElementById("review-heading").textContent =
      labels[ticket.service];
    document.getElementById("ticket-reference").textContent = ticket.reference;
    const dl = document.getElementById("ticket-details");
    dl.replaceChildren();
    [["Service", labels[ticket.service]], ...ticket.entries].forEach(
      ([key, value]) => {
        const row = document.createElement("div"),
          dt = document.createElement("dt"),
          dd = document.createElement("dd");
        dt.textContent = key;
        dd.textContent = value;
        row.append(dt, dd);
        dl.append(row);
      },
    );
    const link = document.getElementById("email-request");
    link.href = `mailto:${ticket.recipient}?subject=${encodeURIComponent(ticket.subject)}&body=${encodeURIComponent(ticket.text)}`;
    document.getElementById("recipient").textContent = ticket.recipient;
    document.getElementById("email-only").href =
      `mailto:${ticket.recipient}?subject=${encodeURIComponent(ticket.subject)}`;
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (step === 1) {
      if (!selectedService()) {
        error.hidden = false;
        error.textContent =
          "Choose the service you need, or select “I’m not sure.”";
        serviceInputs[0].focus();
        return;
      }
      renderDetails();
      showStep(2);
      return;
    }
    if (step === 2) {
      const phone = form.elements.namedItem("Phone");
      const digits = phone.value.replace(/\D/g, "");
      phone.setCustomValidity(
        digits.length >= 10 && digits.length <= 15
          ? ""
          : "Enter a phone number with at least 10 digits, including the area code.",
      );
      const zip = form.elements.namedItem("ZIP code");
      zip.setCustomValidity(
        /^\d{5}(-\d{4})?$/.test(zip.value.trim())
          ? ""
          : "Enter a 5-digit ZIP code, optionally followed by a 4-digit extension.",
      );
      const invalid = [
        ...panels[1].querySelectorAll("input,select,textarea"),
      ].find((el) => !el.checkValidity());
      if (invalid) {
        error.hidden = false;
        error.textContent =
          "Please check the highlighted field before continuing.";
        invalid.reportValidity();
        return;
      }
      review();
      showStep(3);
    }
  });
  form
    .querySelectorAll("[data-back]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        showStep(Number(button.dataset.back)),
      ),
    );
  const params = new URLSearchParams(location.search);
  const aliases = {
    residential: "residential-new",
    commercial: "commercial-new",
    gates: "gate",
  };
  const preset = aliases[params.get("service")] || params.get("service");
  const target = serviceInputs.find((input) => input.value === preset);
  if (target) {
    target.checked = true;
    renderDetails();
  }
  const issue = params.get("issue");
  if (issue) {
    const notes = form.elements.namedItem("Request details");
    notes.value = issue.slice(0, 600);
  }
  const announce = (message) => {
    status.hidden = false;
    status.textContent = message;
  };
  document
    .getElementById("email-request")
    .addEventListener("click", () =>
      announce(
        "Your email app may open. Review the draft and press Send there to complete your request. If it doesn’t open, use Copy request or Download request below.",
      ),
    );
  document
    .getElementById("copy-request")
    .addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(
          `${ticket.subject}\nTo: ${ticket.recipient}\n\n${ticket.text}`,
        );
        announce(
          "Request copied. Paste it into an email to " +
            ticket.recipient +
            ". Add photos if helpful, then send.",
        );
      } catch (_) {
        announce(
          "Copy is unavailable in this browser. Use Download request, or select the request details and copy them manually.",
        );
      }
    });
  document.getElementById("download-request").addEventListener("click", () => {
    const blob = new Blob(
      [`To: ${ticket.recipient}\nSubject: ${ticket.subject}\n\n${ticket.text}`],
      {
        type: "text/plain;charset=utf-8",
      },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${ticket.reference}.txt`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(
      "Request downloaded. Attach or paste it into an email to " +
        ticket.recipient +
        ". We will receive your request after you send the email.",
    );
  });
  document
    .getElementById("print-request")
    .addEventListener("click", () => window.print());
  // Keep the page heading as the initial reading position; focus moves only after interaction.
})();
