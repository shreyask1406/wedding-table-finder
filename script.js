let guests = [];
let sheetReady = false;
let pendingSearch = false;

const CACHE_KEY = "wedding-table-guests-v1";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.'’\-]/g, "");
}

function cellValue(cell) {
  if (!cell || cell.v === null || cell.v === undefined) return "";
  return String(cell.v).trim();
}

function loadCachedGuests() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (Array.isArray(cached) && cached.length) {
      guests = cached;
      sheetReady = true;
    }
  } catch (_) {}
}

loadCachedGuests();

function sheetLoaded(response) {
  try {
    if (!response || response.status === "error" || !response.table) {
      throw new Error("Google Sheet did not return usable data.");
    }

    const headers = response.table.cols.map((column) =>
      String(column.label || "").trim().toLowerCase()
    );

    const firstNameIndex = headers.indexOf("first name");
    const lastNameIndex = headers.indexOf("last name");
    const tableNumberIndex = headers.indexOf("table number");

    if (firstNameIndex === -1 || lastNameIndex === -1 || tableNumberIndex === -1) {
      throw new Error("Expected columns were not found.");
    }

    guests = response.table.rows
      .map((row) => {
        const cells = row.c || [];
        return {
          firstName: cellValue(cells[firstNameIndex]),
          lastName: cellValue(cells[lastNameIndex]),
          tableNumber: cellValue(cells[tableNumberIndex]),
        };
      })
      .filter((guest) => guest.firstName || guest.lastName);

    sheetReady = true;

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(guests));
    } catch (_) {}

    if (pendingSearch) {
      pendingSearch = false;
      findGuest();
    }
  } catch (error) {
    console.error(error);

    if (!sheetReady) {
      document.getElementById("result").innerHTML = `
        <div class="error">
          We’re having trouble loading the seating list.<br>
          Please refresh and try again.
        </div>
      `;
    }
  }
}

function findGuest() {
  const input = document.getElementById("guestName");
  const result = document.getElementById("result");
  const searchValue = normalize(input.value);

  if (!searchValue) {
    result.innerHTML = '<div class="error">Please enter your full name.</div>';
    return;
  }

  if (!sheetReady) {
    pendingSearch = true;
    result.innerHTML = '<div class="status">Finding your table…</div>';
    return;
  }

  const matches = guests.filter((guest) =>
    normalize(`${guest.firstName} ${guest.lastName}`) === searchValue
  );

  if (matches.length === 1) {
    const guest = matches[0];

    if (!guest.tableNumber) {
      result.innerHTML = `
        <div class="error">
          Your table assignment is not available yet.
        </div>
      `;
      return;
    }

    result.innerHTML = `
      <div class="found-name">Welcome, ${guest.firstName}!</div>
      <div class="table-label">Your table</div>
      <div class="table-result">Table ${guest.tableNumber}</div>
      <div class="welcome">We’re so happy you’re here.</div>
    `;
    return;
  }

  if (matches.length > 1) {
    result.innerHTML = `
      <div class="error">
        We found more than one guest with that exact name.<br>
        Please ask us for help finding your table.
      </div>
    `;
    return;
  }

  result.innerHTML = `
    <div class="error">
      We couldn’t find that name.<br>
      Please check the spelling and enter your full name.
    </div>
  `;
}

document.getElementById("findButton").addEventListener("click", findGuest);

document.getElementById("guestName").addEventListener("keydown", (event) => {
  if (event.key === "Enter") findGuest();
});
