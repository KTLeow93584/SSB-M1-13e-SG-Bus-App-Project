import { getBusTiming as callBusTimingAPI } from "./sg-bus-api.js";
// ====================================
// Bus Stop List Reference:
// https://observablehq.com/@cheeaun/list-of-bus-stops-in-singapore
// Note, API can return error 500 response (Server-end issue) on extremely high ID inputs. (E.g. Bus Stop ID: 100000)
// Currently there's no handler for this case, as the app would stop working and just print out an error on the
// console log during the fetch command.
//
// Example usable bus IDs:
// 1. 10009
// 2. 52499
// 3. 45009
// 4. 64009
// ====================================
const busIDInputElement = document.getElementById("bus-stop-id");
const infoTextElement = document.getElementById("bus-arrival-info");
const warningTextElement = document.getElementById("warning");

const filterSelectorElement = document.getElementById("bus-filter-selector");
const filterRowElement = document.getElementById("bus-filter-group");
const filterInputElement = document.getElementById("bus-filter-input");
const filterButtonElement = document.getElementById("bus-filter-button");

const scheduleTableElement = document.getElementById("list-table");
const busStopIDIdentifier = "Bus Stop ID";

const milisecondsPerMin = 60000;
const minutesPerHour = 60;

let storedBusServices = [];
let filterQuery = "none";
let nowTime = null;
// ====================================
function getBusTiming() {
  hideWarning();
  hideInfo();
  hideTable();
  hideFilterGroup();

  const idInput = busIDInputElement.value;

  const requiredFields = [];
  const invalidFields = [];

  if (idInput.trim().length === 0)
    requiredFields.push(busStopIDIdentifier);

  if (requiredFields.length > 0) {
    showWarning(`Missing required field(s). [${requiredFields.join(", ")}]`);
    return;
  }

  if (isNaN(parseInt(idInput)))
    invalidFields.push(busStopIDIdentifier);

  if (invalidFields.length > 0) {
    showWarning(`Invalid input format (Numeric only) on the following field(s). [${invalidFields.join(", ")}].`);
    return;
  }
  showInfo("Loading...");

  retrieveBusServiceInfo(idInput);
}
// ====================================
function retrieveBusServiceInfo(busId) {
  storedBusServices = [];
  
  callBusTimingAPI(busId)
  .then((result) => {
    const data = result.data;

    // Debug
    //console.log("Result.", result);

    if (result.success) {
      let services = data.services;
      nowTime = new Date();

      if (services.length > 0) {
        // Sort by Ascending (Closest ETA to Furthest ETA).
        services = services.sort((element1, element2) => {
          const element1NextMin = new Date(element1.next.time) - nowTime;
          const element2NextMin = new Date(element2.next.time) - nowTime;

          return element1NextMin - element2NextMin;
        });

        for (let i = 0; i < services.length; ++i)
          storedBusServices.push(services[i]);
        
        displayBusServices();
      }
      else {
        showWarning(`The Bus Stop [ID: ${busId}] currently has no bus service available.`);
        return;
      }
    }
    else {
      showWarning(result.message);
      return;
    }
  });
}

function displayBusServices() {
  clearTableDataRows();
  
  storedBusServices.forEach((service) => {
    const { no, operator, next, /*subsequent,*/ next2, next3 } = service;
    const destinationBusStopId = next.destination_code;

    // Debug
    //console.log(`[On Display Bus Setvices] Info: ${no}, ${operator}, ${next}.`);

    let passFilter = true;
    
    switch (filterQuery.toLowerCase()) {
      case "bus-number":
        passFilter = no.toLowerCase().includes(filterInputElement.value.toLowerCase());
        break;
      case "bus-operator":
        passFilter = operator.toLowerCase().includes(filterInputElement.value.toLowerCase());
        break;
      case "destination-bus-stop":
        console.log("Number: " + destinationBusStopId + ", Input: " + filterInputElement.value);
        passFilter = destinationBusStopId === filterInputElement.value;
        break;
    }
    // Debug
    //console.log("[On Display Bus Setvices] Pass Filter: " + passFilter + ", Query: " + filterQuery);
    
    if (!passFilter)
      return;
    // =================
    let newRow = scheduleTableElement.insertRow(scheduleTableElement.rows.length);
    newRow.classList.add("list-table-border");
    // =================
    // Bus Number
    let newCell = newRow.insertCell();
    newCell.textContent = no;
    newCell.classList.add("list-table-border");
    newCell.classList.add("list-table-odd-cell");
    // =================
    // Bus Operator
    newCell = newRow.insertCell();
    newCell.textContent = operator;
    newCell.classList.add("list-table-border");
    newCell.classList.add("list-table-even-cell");
    // =================
    // Destination Bus Stop Code
    newCell = newRow.insertCell();
    newCell.textContent = destinationBusStopId;
    newCell.classList.add("list-table-border");
    newCell.classList.add("list-table-odd-cell");
    // =================
    // Arrival ETA for next bus.
    newCell = newRow.insertCell();
    const nextMin = Math.ceil((new Date(next.time) - nowTime) / milisecondsPerMin);
    newCell.textContent = nextMin < 1 ? "Now" : nextMin;
    newCell.classList.add("list-table-border");
    newCell.classList.add("list-table-even-cell");
    // =================
    // Arrival ETA for subsequent bus(es) up to next two.
    // From observation, "subsequent" = "next2" from API results.
    newCell = newRow.insertCell();

    const subsequentBuses = [];
    if (next2 !== null && next2 !== undefined)
      subsequentBuses.push(next2);
    if (next3 !== null && next3 !== undefined)
      subsequentBuses.push(next3);

    let listHTML = "";
    subsequentBuses.forEach((busArrival, iter) => {
      const arriveDate = new Date(busArrival.time);
      const subsequentMin = Math.ceil((arriveDate - Date.now()) / milisecondsPerMin);
      const arrivalHourMin = arriveDate.toLocaleString('en-US', { hour: "numeric", minute: "numeric", hour12: true });

      listHTML += `
        <li id="list-eta-option-${iter + 1}" class="w-20 text-center">
          <small class="fs-6">${subsequentMin} minutes (${arrivalHourMin})</small>
        </li>
      `;
    });
    newCell.innerHTML = `
      <div class="btn-group dropend">
        <button id="list-eta-dropdown" class="btn btn-sm btn-secondary rounded"
          data-bs-toggle="dropdown" aria-expanded="false">
          Click/Tap to View More
        </button>
        <ul class="dropdown-menu" aria-labelledby="list-eta-dropdown">
          ${listHTML}
        </ul>
      </div>
    `;
    newCell.classList.add("list-table-border");
    newCell.classList.add("list-table-odd-cell");
    // =================
  });
  // Timezone Offset
  // Difference between Universal Timezone (+0/UTC) and Web Server Location's Timezone.
  // E.g. 
  // Let the value of Universal Timezome be "0".
  // Let the value of locations under GMT+8 (like Singapore, Hong Kong, Malaysia) be "8";
  // 0 - 8 = -8.
  // Thus, we need to inverse it to show the format correctly.
  const timezone = nowTime.getTimezoneOffset();
  const gmtHours = formatTime(Math.floor(timezone / minutesPerHour));
  const gmtMinutes = formatTime(nowTime.getTimezoneOffset() % minutesPerHour);

  showInfo(`Data is updated as of ${nowTime.toLocaleString()}, GMT${timezone < 0 ? "+" : "-"}${gmtHours + ":" + gmtMinutes}.`);
  
  showTable();
  showFilterGroup();
}
// ====================================
function formatTime(value) {
  if (value < 0) {
    const valueStr = value.toString();
    return (Math.abs(value) < 10) ? ("0" + valueStr.substring(1)) : value;
  }
  else
    return (value < 10) ? ("0" + value.toString()) : value;
}

function showWarning(str) {
  warningTextElement.innerHTML = str;

  if (warningTextElement.classList.contains("hidden"))
    warningTextElement.classList.remove("hidden");

  hideInfo();
}

function hideWarning() {
  if (!warningTextElement.classList.contains("hidden"))
    warningTextElement.classList.add("hidden");
}

function showInfo(str) {
  infoTextElement.innerHTML = str;

  if (infoTextElement.classList.contains("hidden"))
    infoTextElement.classList.remove("hidden");
}

function hideInfo() {
  if (!infoTextElement.classList.contains("hidden"))
    infoTextElement.classList.add("hidden");
}

function showFilterGroup() {
  if (filterRowElement.classList.contains("hidden"))
    filterRowElement.classList.remove("hidden");
}

function hideFilterGroup() {
  if (!filterRowElement.classList.contains("hidden"))
    filterRowElement.classList.add("hidden");
}

function showTable() {
  if (scheduleTableElement.classList.contains("hidden"))
    scheduleTableElement.classList.remove("hidden");
}

function hideTable() {
  if (!scheduleTableElement.classList.contains("hidden"))
    scheduleTableElement.classList.add("hidden");
}

function clearTableDataRows() {
  for (let i = 1; i < scheduleTableElement.rows.length;)
    scheduleTableElement.deleteRow(i);
}
// ====================================
function setFilterQuery(filterType) {
  filterQuery = filterType.toLowerCase();
  
  switch (filterQuery.toLowerCase()) {
    case "bus-number":
      filterInputElement.type = "text";
      filterInputElement.value = "";

      filterInputElement.classList.remove("hidden");

      filterButtonElement.classList.remove("hidden");
      filterButtonElement.classList.add("btn", "btn-sm", "btn-secondary");
      
      filterSelectorElement.textContent = "Bus Number";
      break;
    case "bus-operator":
      filterInputElement.type = "text";
      filterInputElement.value = "";

      filterInputElement.classList.remove("hidden");

      filterButtonElement.classList.remove("hidden");
      filterButtonElement.classList.add("btn", "btn-sm", "btn-secondary");

      filterSelectorElement.textContent = "Bus Operator";
      break;
    case "destination-bus-stop":
      filterInputElement.type = "number";
      filterInputElement.value = "";

      filterInputElement.classList.remove("hidden");

      filterButtonElement.classList.remove("hidden");
      filterButtonElement.classList.add("btn", "btn-sm", "btn-secondary");

      filterSelectorElement.textContent = "Destination Bus Stop ID";
      break;
    case "none":
      filterInputElement.type = "text";
      filterInputElement.value = "";

      filterInputElement.classList.add("hidden");

      filterButtonElement.classList.add("hidden");
      filterButtonElement.classList.remove("btn", "btn-sm", "btn-secondary");

      filterSelectorElement.textContent = "Select Type";
      startFilterProcess();
  }
}

function startFilterProcess() {
  displayBusServices();
}
// ====================================
window.getBusTiming = getBusTiming;

window.setFilterQuery = setFilterQuery;
window.startFilterProcess = startFilterProcess;
// ====================================