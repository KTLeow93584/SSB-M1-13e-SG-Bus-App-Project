//const baseUrl = "https://2t8td6-8080.csb.app/";"
const baseUrl = "https://arrivelah2.busrouter.sg/";

export async function getBusTiming(busStopId) {
  const fullUrl = baseUrl + "?id=" + busStopId;

  // Debug
  //console.log("URL: " + fullUrl);

  const response = await fetch(fullUrl);

  const result = {
    success: false,
    message: "",
    data: null
  };

  if (response.ok) {
    const busData = await response.json();

    // Debug
    //console.log("JSON Data: ", busData);

    if (busData.services !== undefined) {
      result.success = true;
      result.data = busData;
    }
    else {
      result.success = false;
      result.message = "Missing bus ID field. Unable to retrieve services.";
    }
  }
  else {
    result.success = false;
    result.message = "Failed to retrieve data from source.";
  }
  return result;
}