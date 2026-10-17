(() => {
  "use strict";
  const canvas = document.getElementById("door-canvas");
  if (!canvas) return;
  const context = canvas.getContext("2d"),
    texture = document.createElement("canvas");
  texture.width = 900;
  texture.height = 600;
  const tx = texture.getContext("2d");
  const style = document.getElementById("door-style"),
    color = document.getElementById("door-color"),
    windows = document.getElementById("door-windows"),
    fit = document.getElementById("fit-mode"),
    opacity = document.getElementById("door-opacity"),
    status = document.getElementById("visualizer-status");
  const sampleCorners = [
    [0.485, 0.361],
    [0.903, 0.237],
    [0.903, 0.787],
    [0.485, 0.738],
  ];
  let image = null,
    corners = sampleCorners.map((p) => p.slice()),
    dragging = -1,
    customPhoto = false;
  const announce = (text) => {
    status.hidden = false;
    status.textContent = text;
  };
  const syncFields = () =>
    document.querySelectorAll("[data-corner]").forEach((input) => {
      input.value = (
        corners[Number(input.dataset.corner)][
          input.dataset.axis === "x" ? 0 : 1
        ] * 100
      ).toFixed(1);
    });
  const mix = (hex, amount) => {
    const v = hex.replace("#", ""),
      r = parseInt(v.slice(0, 2), 16),
      g = parseInt(v.slice(2, 4), 16),
      b = parseInt(v.slice(4, 6), 16);
    return `rgb(${[r, g, b].map((x) => Math.max(0, Math.min(255, x + amount))).join(",")})`;
  };

  function buildTexture() {
    const c = color.value;
    tx.clearRect(0, 0, 900, 600);
    const gradient = tx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, mix(c, 14));
    gradient.addColorStop(0.7, c);
    gradient.addColorStop(1, mix(c, -20));
    tx.fillStyle = gradient;
    tx.fillRect(0, 0, 900, 600);
    if (c === "#956b48") {
      for (let n = 0; n < 160; n++) {
        const y = (n * 29.73) % 600;
        tx.strokeStyle = n % 2 ? "#00000015" : "#ffffff18";
        tx.lineWidth = (n % 3) + 1;
        tx.beginPath();
        tx.moveTo(0, y);
        tx.bezierCurveTo(230, y - 7, 650, y + 8, 900, y - 2);
        tx.stroke();
      }
    }
    const glass = style.value === "glass",
      cols = style.value === "carriage" ? 4 : glass ? 4 : 3,
      rows = glass ? 3 : 4;
    for (let row = 0; row < rows; row++) {
      const y = (row * 600) / rows;
      tx.strokeStyle = mix(c, -35);
      tx.lineWidth = 3;
      tx.beginPath();
      tx.moveTo(0, y);
      tx.lineTo(900, y);
      tx.stroke();
      tx.strokeStyle = mix(c, 14);
      tx.lineWidth = 1;
      tx.beginPath();
      tx.moveTo(0, y + 3);
      tx.lineTo(900, y + 3);
      tx.stroke();
      if (style.value === "flush") continue;
      for (let col = 0; col < cols; col++) {
        const x = (col * 900) / cols + 13,
          w = 900 / cols - 26,
          h = 600 / rows - 24;
        if (glass || (row === 0 && windows.checked)) {
          const sky = tx.createLinearGradient(x, y, x + w, y + h);
          sky.addColorStop(0, "#829894");
          sky.addColorStop(0.5, "#c0c8bb");
          sky.addColorStop(1, "#596f6b");
          tx.fillStyle = sky;
          tx.fillRect(x, y + 13, w, h);
          tx.strokeStyle = mix(c, -35);
          tx.lineWidth = 6;
          tx.strokeRect(x, y + 13, w, h);
          tx.fillStyle = "#ffffff14";
          tx.beginPath();
          tx.moveTo(x, y + 13);
          tx.lineTo(x + w * 0.5, y + 13);
          tx.lineTo(x + w * 0.15, y + h + 13);
          tx.lineTo(x, y + h + 13);
          tx.fill();
        } else if (style.value === "raised") {
          tx.strokeStyle = mix(c, -23);
          tx.lineWidth = 4;
          tx.strokeRect(x + 7, y + 19, w - 14, h - 14);
          tx.strokeStyle = mix(c, 17);
          tx.lineWidth = 2;
          tx.strokeRect(x + 12, y + 24, w - 24, h - 24);
        } else if (style.value === "carriage") {
          tx.strokeStyle = mix(c, -25);
          tx.lineWidth = 3;
          tx.beginPath();
          tx.moveTo(x + w / 2, y + 10);
          tx.lineTo(x + w / 2, y + 600 / rows - 4);
          tx.stroke();
        }
      }
    }
    if (style.value === "carriage") {
      tx.strokeStyle = mix(c, -40);
      tx.lineWidth = 5;
      tx.beginPath();
      tx.moveTo(450, 0);
      tx.lineTo(450, 600);
      tx.stroke();
      tx.fillStyle = "#161a17";
      tx.fillRect(424, 290, 9, 54);
      tx.fillRect(467, 290, 9, 54);
    }
    if (style.value === "flush" && windows.checked) {
      for (let i = 0; i < 4; i++) {
        tx.fillStyle = "#a4b4ad";
        tx.fillRect(40 + i * 210, 23, 175, 72);
        tx.strokeStyle = mix(c, -30);
        tx.lineWidth = 6;
        tx.strokeRect(40 + i * 210, 23, 175, 72);
      }
    }
    tx.strokeStyle = mix(c, -45);
    tx.lineWidth = 10;
    tx.strokeRect(2, 2, 896, 596);
  }
  // A projective transform keeps straight panel lines aligned with the four opening corners.
  function mapping() {
    const p = corners.map(([x, y]) => [x * canvas.width, y * canvas.height]);
    const [a, b, c, d] = p;
    const dx1 = b[0] - c[0],
      dx2 = d[0] - c[0],
      dx3 = a[0] - b[0] + c[0] - d[0],
      dy1 = b[1] - c[1],
      dy2 = d[1] - c[1],
      dy3 = a[1] - b[1] + c[1] - d[1];
    const den = dx1 * dy2 - dx2 * dy1;
    let g = 0,
      h = 0;
    if (Math.abs(den) > 1e-8) {
      g = (dx3 * dy2 - dx2 * dy3) / den;
      h = (dx1 * dy3 - dx3 * dy1) / den;
    }
    const aa = b[0] - a[0] + g * b[0],
      bb = d[0] - a[0] + h * d[0],
      dd = b[1] - a[1] + g * b[1],
      ee = d[1] - a[1] + h * d[1];
    return (u, v) => {
      const z = g * u + h * v + 1;
      return [(aa * u + bb * v + a[0]) / z, (dd * u + ee * v + a[1]) / z];
    };
  }

  function triangle(s1, s2, s3, d1, d2, d3) {
    const denominator =
      s1[0] * (s2[1] - s3[1]) +
      s2[0] * (s3[1] - s1[1]) +
      s3[0] * (s1[1] - s2[1]);
    if (Math.abs(denominator) < 1e-8) return;
    const coeff = (axis) => [
      (d1[axis] * (s2[1] - s3[1]) +
        d2[axis] * (s3[1] - s1[1]) +
        d3[axis] * (s1[1] - s2[1])) /
        denominator,
      (d1[axis] * (s3[0] - s2[0]) +
        d2[axis] * (s1[0] - s3[0]) +
        d3[axis] * (s2[0] - s1[0])) /
        denominator,
      (d1[axis] * (s2[0] * s3[1] - s3[0] * s2[1]) +
        d2[axis] * (s3[0] * s1[1] - s1[0] * s3[1]) +
        d3[axis] * (s1[0] * s2[1] - s2[0] * s1[1])) /
        denominator,
    ];
    const [a, c, e] = coeff(0),
      [b, d, f] = coeff(1);
    context.save();
    context.beginPath();
    context.moveTo(...d1);
    context.lineTo(...d2);
    context.lineTo(...d3);
    context.closePath();
    context.clip();
    context.transform(a, b, c, d, e, f);
    context.drawImage(texture, 0, 0);
    context.restore();
  }
  const validCorners = () => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = corners[i],
        b = corners[(i + 1) % 4],
        c = corners[(i + 2) % 4];
      const cross =
        (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cross) < 0.0001) return false;
      if (sign && Math.sign(cross) !== sign) return false;
      sign = Math.sign(cross);
    }
    return sign > 0;
  };

  function draw(handles = true) {
    if (!image) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (validCorners()) {
      const map = mapping(),
        parts = 12;
      context.save();
      context.globalAlpha = Number(opacity.value) / 100;
      for (let y = 0; y < parts; y++)
        for (let x = 0; x < parts; x++) {
          const u = x / parts,
            v = y / parts,
            u2 = (x + 1) / parts,
            v2 = (y + 1) / parts;
          const p = map(u, v),
            q = map(u2, v),
            r = map(u2, v2),
            s = map(u, v2);
          if (![...p, ...q, ...r, ...s].every(Number.isFinite)) continue;
          triangle(
            [u * 900, v * 600],
            [u2 * 900, v * 600],
            [u2 * 900, v2 * 600],
            p,
            q,
            r,
          );
          triangle(
            [u * 900, v * 600],
            [u2 * 900, v2 * 600],
            [u * 900, v2 * 600],
            p,
            r,
            s,
          );
        }
      context.restore();
    }
    if (handles && fit.checked) {
      context.save();
      const scale =
        canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
      context.strokeStyle = "#ca2732";
      context.lineWidth = 2 * scale;
      context.beginPath();
      corners.forEach(([x, y], i) =>
        i
          ? context.lineTo(x * canvas.width, y * canvas.height)
          : context.moveTo(x * canvas.width, y * canvas.height),
      );
      context.closePath();
      context.stroke();
      corners.forEach(([x, y], i) => {
        context.beginPath();
        context.arc(
          x * canvas.width,
          y * canvas.height,
          8 * scale,
          0,
          Math.PI * 2,
        );
        context.fillStyle = "#c9232c";
        context.fill();
        context.strokeStyle = "#fff";
        context.lineWidth = 2 * scale;
        context.stroke();
        context.fillStyle = "#fff";
        context.font = `${9 * scale}px Arial`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(i + 1), x * canvas.width, y * canvas.height);
      });
      context.restore();
    }
  }
  const update = () => {
    buildTexture();
    document
      .querySelectorAll("[data-color]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.color === color.value),
        ),
      );
    draw();
  };
  const point = (event) => {
    const box = canvas.getBoundingClientRect();
    return [
      (event.clientX - box.left) / box.width,
      (event.clientY - box.top) / box.height,
    ];
  };
  canvas.addEventListener("pointerdown", (event) => {
    if (!fit.checked) return;
    const p = point(event),
      box = canvas.getBoundingClientRect();
    let nearest = -1,
      distance = 30;
    corners.forEach(([x, y], i) => {
      const d = Math.hypot((x - p[0]) * box.width, (y - p[1]) * box.height);
      if (d < distance) {
        distance = d;
        nearest = i;
      }
    });
    if (nearest < 0) return;
    dragging = nearest;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (dragging < 0) return;
    const p = point(event);
    corners[dragging] = p.map((v) => Math.max(0, Math.min(1, v)));
    syncFields();
    draw();
  });
  const endDrag = () => {
    if (dragging < 0) return;
    dragging = -1;
    if (!validCorners())
      announce(
        "The corners need to form a single opening without crossing. Adjust them or reset the opening.",
      );
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  document.querySelectorAll("[data-corner]").forEach((input) =>
    input.addEventListener("input", () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      corners[Number(input.dataset.corner)][
        input.dataset.axis === "x" ? 0 : 1
      ] = Math.max(0, Math.min(100, value)) / 100;
      draw();
    }),
  );
  document.getElementById("reset-corners").addEventListener("click", () => {
    corners = (
      customPhoto
        ? [
            [0.2, 0.25],
            [0.8, 0.25],
            [0.8, 0.8],
            [0.2, 0.8],
          ]
        : sampleCorners
    ).map((p) => p.slice());
    syncFields();
    draw();
  });
  [style, color, windows, fit, opacity].forEach((control) =>
    control.addEventListener("input", update),
  );
  document.querySelectorAll("[data-color]").forEach((button) =>
    button.addEventListener("click", () => {
      color.value = button.dataset.color;
      update();
    }),
  );
  async function loadPhoto(blob) {
    const bitmap =
      typeof createImageBitmap === "function"
        ? await createImageBitmap(blob, {
            imageOrientation: "from-image",
          })
        : await new Promise((resolve, reject) => {
            const photo = new Image(),
              url = URL.createObjectURL(blob);
            photo.onload = () => {
              URL.revokeObjectURL(url);
              resolve(photo);
            };
            photo.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error("Photo could not be decoded."));
            };
            photo.src = url;
          });
    if (bitmap.width * bitmap.height > 50000000) {
      if (typeof bitmap.close === "function") bitmap.close();
      throw new Error("Choose a photo smaller than 50 megapixels.");
    }
    if (image && typeof image.close === "function") image.close();
    image = bitmap;
    const ratio = Math.min(1, 1600 / bitmap.width, 1200 / bitmap.height);
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    update();
  }
  document
    .getElementById("home-photo")
    .addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        announce("Choose a JPG, PNG, or WebP photo.");
        return;
      }
      if (file.size > 15 * 1048576) {
        announce("Choose a photo smaller than 15 MB.");
        return;
      }
      try {
        await loadPhoto(file);
        customPhoto = true;
        corners = [
          [0.2, 0.25],
          [0.8, 0.25],
          [0.8, 0.8],
          [0.2, 0.8],
        ];
        syncFields();
        draw();
        announce(
          "Your photo is ready. Drag the four red handles to the garage door opening. It stays in your browser.",
        );
      } catch (error) {
        announce("Could not open this photo. " + error.message);
      }
    });
  document.getElementById("save-preview").addEventListener("click", () => {
    if (!image || !validCorners()) {
      announce("Fit the four corners to a single opening before downloading.");
      return;
    }
    draw(false);
    const labelHeight = Math.max(32, Math.round(canvas.width * 0.025));
    context.fillStyle = "#fffffff0";
    context.fillRect(0, canvas.height - labelHeight, canvas.width, labelHeight);
    context.fillStyle = "#283325";
    context.font = `${Math.max(10, Math.round(canvas.width * 0.0095))}px Arial`;
    context.textAlign = "left";
    context.fillText(
      `Amarillo design concept | ${style.options[style.selectedIndex].text} | Illustrative only — confirm product and color`,
      12,
      canvas.height - labelHeight / 2 + 4,
    );
    canvas.toBlob((blob) => {
      if (!blob) {
        announce("Could not export the preview. Try another photo.");
        draw();
        return;
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "garage-door-style-concept.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      draw();
      announce(
        "Preview downloaded. Attach it to an estimate request to show the team the look you have in mind.",
      );
    }, "image/png");
  });
  syncFields();
  fetch("assets/amarillo-garage-hero.jpg")
    .then((r) => {
      if (!r.ok) throw new Error();
      return r.blob();
    })
    .then(loadPhoto)
    .catch(() => announce("Choose a home photo to start the preview."));
  if (typeof ResizeObserver === "function")
    new ResizeObserver(() => draw()).observe(canvas);
  else window.addEventListener("resize", () => draw());
})();
