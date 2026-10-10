"use strict";

/* =========================================
   SIGNA — SIGNED MAGNITUDE DIVISION
   Frontend controller
   ========================================= */

const API_URL = "https://signed-division-4.onrender.com/api/divide";

const $ = (id) => document.getElementById(id);

const form = $("divisionForm");
const dividendInput = $("dividend");
const divisorInput = $("divisor");
const bitsInput = $("bits");
const startBtn = $("startBtn");
const resetBtn = $("resetBtn");
const prevBtn = $("prevBtn");
const nextBtn = $("nextBtn");
const autoBtn = $("autoBtn");
const errorMessage = $("errorMessage");

let trace = [];
let result = null;
let currentIndex = 0;
let autoTimer = null;
let isRunning = false;
let runWidth = 4; // register width used for the current run

/* =========================================
   GENERAL HELPERS
   ========================================= */

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = String(value ?? "");
}

function showError(message) {
  if (!errorMessage) return;
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  if (!errorMessage) return;
  errorMessage.textContent = "";
  errorMessage.hidden = true;
}

function setBackendStatus(online) {
  const dot = $("backendDot");
  const status = $("backendStatus");

  if (dot) dot.classList.toggle("offline", !online);
  if (status) {
    status.textContent = online ? "BACKEND CONNECTED" : "BACKEND OFFLINE";
  }
}

function binary(value, width) {
  const number = Math.abs(Number(value) || 0);
  return number.toString(2).padStart(width, "0").slice(-width);
}

function signedMagnitudeBinary(value, width) {
  const number = Number(value);
  const sign = number < 0 ? "1" : "0";
  return sign + binary(number, width);
}

function formatRegister(value, width) {
  const bits = binary(value, width);

  return [...bits].map((bit) => {
    const span = document.createElement("span");
    span.className = "bit" + (bit === "0" ? " muted-bit" : "");
    span.textContent = bit;
    return span;
  });
}

function renderRegister(id, value, width) {
  const container = $(id);
  if (!container) return;

  container.replaceChildren(...formatRegister(value, width));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/* =========================================
   SIGN ANALYSIS
   ========================================= */

function renderSignAnalysis(data) {
  const dividend = Number(data.dividend);
  const divisor = Number(data.divisor);

  const dividendNegative =
    data.dividend_sign !== undefined
      ? String(data.dividend_sign) === "1" ||
        String(data.dividend_sign).toLowerCase() === "negative"
      : dividend < 0;

  const divisorNegative =
    data.divisor_sign !== undefined
      ? String(data.divisor_sign) === "1" ||
        String(data.divisor_sign).toLowerCase() === "negative"
      : divisor < 0;

  const quotientNegative = dividendNegative !== divisorNegative;

  setText("dividendSign", dividendNegative ? "NEGATIVE" : "POSITIVE");
  setText("dividendSignDetail", `Sign bit · ${dividendNegative ? 1 : 0}`);

  setText("divisorSign", divisorNegative ? "NEGATIVE" : "POSITIVE");
  setText("divisorSignDetail", `Sign bit · ${divisorNegative ? 1 : 0}`);

  setText("quotientSign", quotientNegative ? "NEGATIVE" : "POSITIVE");
  setText(
    "quotientSignDetail",
    `${dividendNegative ? 1 : 0} XOR ${divisorNegative ? 1 : 0} = ${quotientNegative ? 1 : 0}`
  );
}

/* =========================================
   REGISTER DISPLAY
   ========================================= */

function renderRegisters(step, width) {
  if (!step) return;

  const A = safeNumber(step.A);
  const Q = safeNumber(step.Q);
  const B = safeNumber(step.B);

  renderRegister("regA", A, width);
  renderRegister("regQ", Q, width);
  renderRegister("regB", B, width);

  setText("valA", A);
  setText("valQ", Q);
  setText("valB", B);

  setText("regE", step.E ?? 0);
  setText("regSC", step.SC ?? "—");

  setText("stateA", "ACTIVE");
  setText("stateQ", "ACTIVE");
  setText("stateB", "FIXED");

  setText("stepBadge", `STEP ${currentIndex + 1}`);
}

/* =========================================
   CURRENT OPERATION
   ========================================= */

function renderOperation(step) {
  setText("currentOperation", step.operation || "Processing");
  setText("operationDetail", step.detail || "Register state updated.");

  setText(
    "decisionBadge",
    step.decision === undefined ? "IN PROGRESS" : step.decision
  );

  setText("operationIndex", `Step ${currentIndex + 1} of ${trace.length}`);

  const percentage = trace.length > 0
    ? Math.round(((currentIndex + 1) / trace.length) * 100)
    : 0;

  setText("progressText", `${percentage}%`);

  const progressBar = $("progressBar");
  if (progressBar) progressBar.style.width = `${percentage}%`;

  setText("iterationValue", `${currentIndex + 1} / ${trace.length}`);
  setText("iterationDetail", "Execution operations");
}

/* =========================================
   TRACE TABLE
   ========================================= */

function renderTraceTable(width) {
  const body = $("traceBody");
  if (!body) return;

  body.replaceChildren();

  if (trace.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.className = "empty-row";
    cell.textContent = "Your execution trace will appear here.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  trace.forEach((step, index) => {
    const row = document.createElement("tr");

    if (index === currentIndex) {
      row.classList.add("active-row");
    }

    const values = [
      step.step ?? index + 1,
      step.operation ?? "Operation",
      binary(step.A, width),
      binary(step.Q, width),
      binary(step.B, width),
      step.E ?? 0,
      step.SC ?? "—",
      step.decision ?? "—"
    ];

    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.appendChild(cell);
    });

    body.appendChild(row);
  });

  setText("traceCount", `${trace.length} OPERATIONS`);

  // Scroll only inside the table box (scrollIntoView made the whole page jump)
  const activeRow = body.querySelector(".active-row");
  const box = body.closest(".table-container");
  if (activeRow && box && typeof box.scrollTo === "function") {
    const top = activeRow.offsetTop - box.clientHeight / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
}

/* =========================================
   FINAL RESULT
   ========================================= */

function renderResult(data, width) {
  if (!data) return;

  setText("resultStatus", data.overflow ? "OVERFLOW" : "COMPLETED");
  setText("quotientResult", data.quotient ?? "—");
  setText("remainderResult", data.remainder ?? "—");

  if (data.quotient_binary !== undefined) {
    setText("quotientBinary", `Binary · ${data.quotient_binary}`);
  } else {
    setText(
      "quotientBinary",
      `Sign · Magnitude · ${signedMagnitudeBinary(data.quotient, width)}`
    );
  }

  if (data.remainder_binary !== undefined) {
    setText("remainderBinary", `Binary · ${data.remainder_binary}`);
  } else {
    setText(
      "remainderBinary",
      `Sign · Magnitude · ${signedMagnitudeBinary(data.remainder, width)}`
    );
  }

  const valid = data.verification === true ||
    (data.verification && data.verification.valid === true);

  setText(
    "verificationTitle",
    valid ? "Arithmetic verification passed" : "Verification information"
  );

  if (typeof data.verification === "string") {
    setText("verificationText", data.verification);
  } else if (data.verification && typeof data.verification === "object") {
    setText(
      "verificationText",
      data.verification.message ||
      (valid ? "Dividend = Quotient × Divisor + Remainder." : "Check the backend verification result.")
    );
  } else {
    const dividend = Number(data.dividend);
    const divisor = Number(data.divisor);
    const quotient = Number(data.quotient);
    const remainder = Number(data.remainder);

    if ([dividend, divisor, quotient, remainder].every(Number.isFinite)) {
      setText(
        "verificationText",
        `${dividend} = (${quotient} × ${divisor}) + (${remainder})`
      );
    } else {
      setText("verificationText", "Result received from the division backend.");
    }
  }
}

/* =========================================
   NAVIGATION
   ========================================= */

function stopAutoRun() {
  if (autoTimer !== null) {
    clearInterval(autoTimer);
    autoTimer = null;
  }

  if (autoBtn) autoBtn.textContent = "▶ Auto run";
}

function renderCurrentStep() {
  if (!trace.length) return;

  currentIndex = Math.max(0, Math.min(currentIndex, trace.length - 1));

  const width = runWidth;
  const step = trace[currentIndex];

  renderRegisters(step, width);
  renderOperation(step);
  renderTraceTable(width);

  if (prevBtn) prevBtn.disabled = currentIndex === 0;
  if (nextBtn) nextBtn.disabled = currentIndex >= trace.length - 1;

  if (currentIndex === trace.length - 1) {
    stopAutoRun();
  }
}

function goPrevious() {
  stopAutoRun();

  if (currentIndex > 0) {
    currentIndex--;
    renderCurrentStep();
  }
}

function goNext() {
  if (currentIndex < trace.length - 1) {
    currentIndex++;
    renderCurrentStep();
  }
}

function toggleAutoRun() {
  if (autoTimer !== null) {
    stopAutoRun();
    return;
  }

  if (trace.length === 0 || currentIndex >= trace.length - 1) return;

  if (autoBtn) autoBtn.textContent = "Ⅱ Pause";

  autoTimer = setInterval(() => {
    if (currentIndex >= trace.length - 1) {
      stopAutoRun();
      return;
    }

    currentIndex++;
    renderCurrentStep();
  }, 900);
}

/* =========================================
   RUN DIVISION
   ========================================= */

async function runDivision(event) {
  if (event) event.preventDefault();

  stopAutoRun();
  clearError();

  const dividend = Number(dividendInput.value);
  const divisor = Number(divisorInput.value);
  const bits = Number(bitsInput.value);

  if (!Number.isInteger(dividend) || !Number.isInteger(divisor)) {
    showError("Enter whole-number values for both dividend and divisor.");
    return;
  }

  if (divisor === 0) {
    showError("The divisor cannot be zero.");
    return;
  }

  if (!Number.isInteger(bits) || bits < 2 || bits > 16) {
    showError("Choose a valid register width between 2 and 16 bits.");
    return;
  }

  const maxMagnitude = (2 ** bits) - 1;

  if (Math.abs(dividend) > maxMagnitude || Math.abs(divisor) > maxMagnitude) {
    showError(`The selected ${bits}-bit magnitude register can represent magnitudes from 0 to ${maxMagnitude}.`);
    return;
  }

  isRunning = true;
  startBtn.disabled = true;
  setText("resultStatus", "PROCESSING");

  const originalButtonText = startBtn.innerHTML;
  startBtn.textContent = "Running...";
  
  let reachedBackend = false;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        dividend,
        divisor,
        bits
      })
    });

    reachedBackend = true;
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Backend returned HTTP ${response.status}.`
      );
    }

    if (!Array.isArray(data.trace) || data.trace.length === 0) {
      throw new Error("The backend returned no execution trace. Check division.py.");
    }

    result = {
      ...data,
      dividend,
      divisor
    };

    trace = data.trace;
    runWidth = bits;
    currentIndex = 0;

    renderSignAnalysis(result);
    renderResult(result, bits);

    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = trace.length <= 1;
    if (autoBtn) autoBtn.disabled = trace.length <= 1;

    renderCurrentStep();
    setBackendStatus(true);

  } catch (error) {
    console.error("Division error:", error);

    trace = [];
    result = null;
    currentIndex = 0;

    showError(
      !reachedBackend
        ? "Cannot connect to the backend. Open a terminal in the folder with app.py and run: python app.py"
        : error.message
    );

    setText("resultStatus", "ERROR");
    setText("currentOperation", "Execution failed");
    setText("operationDetail", "Correct the error and run the simulator again.");

    setBackendStatus(false);

  } finally {
    isRunning = false;
    startBtn.disabled = false;
    startBtn.innerHTML = originalButtonText;
  }
}

/* =========================================
   RESET
   ========================================= */

function resetSimulation() {
  stopAutoRun();
  clearError();

  trace = [];
  result = null;
  currentIndex = 0;

  setText("dividendSign", "READY");
  setText("dividendSignDetail", "Sign bit · —");
  setText("divisorSign", "READY");
  setText("divisorSignDetail", "Sign bit · —");
  setText("quotientSign", "READY");
  setText("quotientSignDetail", "XOR of operand signs");
  setText("iterationValue", "READY");
  setText("iterationDetail", "Awaiting execution");

  setText("stepBadge", "NO EXECUTION");
  setText("stateA", "IDLE");
  setText("stateQ", "IDLE");
  setText("stateB", "FIXED");

  const width = Number(bitsInput.value) || 4;

  renderRegister("regA", 0, width);
  renderRegister("regQ", 0, width);
  renderRegister("regB", Math.abs(Number(divisorInput.value) || 0), width);

  setText("valA", "0");
  setText("valQ", "0");
  setText("valB", Math.abs(Number(divisorInput.value) || 0));
  setText("regE", "0");
  setText("regSC", "—");

  setText("currentOperation", "Initialize to begin");
  setText("operationDetail", "Configure your operands and run the division algorithm.");
  setText("decisionBadge", "WAITING");
  setText("operationIndex", "Step 0 of 0");
  setText("progressText", "0%");
  setText("traceCount", "0 OPERATIONS");

  const progressBar = $("progressBar");
  if (progressBar) progressBar.style.width = "0%";

  setText("resultStatus", "PENDING");
  setText("quotientResult", "—");
  setText("quotientBinary", "Sign · Magnitude");
  setText("remainderResult", "—");
  setText("remainderBinary", "Sign · Magnitude");
  setText("verificationTitle", "Verification pending");
  setText("verificationText", "The arithmetic check will appear after successful execution.");

  const body = $("traceBody");
  if (body) {
    body.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 8;
    cell.className = "empty-row";
    cell.textContent = "Your execution trace will appear here.";

    row.appendChild(cell);
    body.appendChild(row);
  }

  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  if (autoBtn) autoBtn.disabled = true;
}

/* =========================================
   EVENT LISTENERS
   ========================================= */

if (form) {
  form.addEventListener("submit", runDivision);
}

if (resetBtn) {
  resetBtn.addEventListener("click", resetSimulation);
}

if (prevBtn) {
  prevBtn.addEventListener("click", goPrevious);
}

if (nextBtn) {
  nextBtn.addEventListener("click", goNext);
}

if (autoBtn) {
  autoBtn.addEventListener("click", toggleAutoRun);
}

bitsInput.addEventListener("change", () => {
  if (!trace.length) {
    resetSimulation();
  }
});

/* =========================================
   BACKEND CONNECTION CHECK
   ========================================= */

async function checkBackend() {
  try {
    const response = await fetch(API_URL, {
      method: "OPTIONS"
    });

    setBackendStatus(response.ok);
  } catch {
    setBackendStatus(false);
  }
}

resetSimulation();
checkBackend();
setInterval(checkBackend, 4000); // keeps the badge correct if Flask starts late
