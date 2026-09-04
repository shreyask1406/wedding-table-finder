const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1TxEjxEEfjewjwUWLthwA4iU8IykBBk2QlMwcyV3xFurLMGJAfbj46xNN2yxeqRITQib3zxNQLbtn/pub?gid=1628993218&single=true&output=csv";

let guests = [];
let sheetReady = false;
let sheetError = false;

const input = document.getElementById("guestName");
const button = document.getElementById("findButton");
const result = document.getElementById("result");

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[.'’]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(value);

      if (row.some(cell => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);

  if (row.some(cell => cell.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

async function loadGuests() {
  try {
    const response = await fetch(
      `${SHEET_URL}&refresh=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Could not load Google Sheet.");
    }

    const text = await response.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      throw new Error("Guest list is empty.");
    }

    const headers = rows[0].map(header =>
      normalizeName(header)
    );

    const firstNameIndex = headers.indexOf("first name");
    const lastNameIndex = headers.indexOf("last name");
    const tableIndex = headers.indexOf("table number");
    const alternateNameIndex = headers.indexOf("alternate name");
    const partyIdIndex = headers.indexOf("party id");

    if (
      firstNameIndex === -1 ||
      lastNameIndex === -1 ||
      tableIndex === -1 ||
      partyIdIndex === -1
    ) {
      throw new Error("Required columns were not found.");
    }

    guests = rows
      .slice(1)
      .map(row => {
        const firstName =
          (row[firstNameIndex] || "").trim();

        const lastName =
          (row[lastNameIndex] || "").trim();

        const tableNumber =
          (row[tableIndex] || "").trim();

        const alternateName =
          alternateNameIndex !== -1
            ? (row[alternateNameIndex] || "").trim()
            : "";

        const partyId =
          (row[partyIdIndex] || "").trim();

        return {
          firstName,
          lastName,
          tableNumber,
          alternateName,
          partyId,

          fullNameNormalized:
            normalizeName(`${firstName} ${lastName}`),

          alternateNameNormalized:
            normalizeName(alternateName)
        };
      })
      .filter(
        guest =>
          guest.firstName ||
          guest.lastName
      );

    sheetReady = true;
    sheetError = false;

    console.log(`Loaded ${guests.length} guests.`);
  } catch (error) {
    console.error("Guest list failed to load:", error);
    sheetError = true;
  }
}

function showTable(guest) {
  const partyMembers = guests.filter(
    person =>
      person.partyId &&
      person.partyId === guest.partyId
  );

  // If there is no usable Party ID, just show the searched guest
  const members =
    partyMembers.length > 0
      ? partyMembers
      : [guest];

  const firstNames = members.map(
    person => person.firstName
  );

  let namesText = "";

  if (firstNames.length === 1) {
    namesText = firstNames[0];
  } else if (firstNames.length === 2) {
    namesText = `${firstNames[0]} & ${firstNames[1]}`;
  } else {
    namesText =
      firstNames.slice(0, -1).join(", ") +
      " & " +
      firstNames[firstNames.length - 1];
  }

  result.innerHTML = `
    <div class="table-label">
      ${namesText}
    </div>

    <div class="table-number">
      Table ${guest.tableNumber}
    </div>
  `;
}

function findGuest() {
  const enteredName = normalizeName(input.value);

  result.className = "";

  if (!enteredName) {
    result.textContent =
      "Please enter your first and last name.";

    result.className = "message";
    return;
  }

  if (!enteredName.includes(" ")) {
    result.textContent =
      "Please enter both your first and last name.";

    result.className = "message";
    return;
  }

  if (sheetError) {
    result.textContent =
      "We couldn't load the guest list. Please refresh the page and try again.";

    result.className = "message";
    return;
  }

  if (!sheetReady) {
    result.textContent =
      "Finding your table…";

    result.className = "message";
    return;
  }

  const matches = guests.filter(
    guest =>
      guest.fullNameNormalized === enteredName ||
      (
        guest.alternateNameNormalized &&
        guest.alternateNameNormalized === enteredName
      )
  );

  if (matches.length === 1) {
    const guest = matches[0];

    if (!guest.tableNumber) {
      result.textContent =
        "Your table assignment isn't available yet.";

      result.className = "message";
      return;
    }

    showTable(guest);
    return;
  }

  if (matches.length > 1) {
    const tableNumbers = [
      ...new Set(
        matches
          .map(guest => guest.tableNumber)
          .filter(Boolean)
      )
    ];

    if (tableNumbers.length === 1) {
      showTable(matches[0]);
      return;
    }

    result.textContent =
      "We found more than one guest with that name. Please enter the name exactly as it appears on your invitation.";

    result.className = "message";
    return;
  }

  result.textContent =
    "We couldn't find that name. Please check the spelling and enter your first and last name.";

  result.className = "message";
}

button.addEventListener("click", findGuest);

input.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    findGuest();
  }
});

loadGuests();