// Runs before first paint so the page never flashes the wrong theme.
// Default is dark (matches the logo). The toggle in the header saves the choice on this device.
(function () {
  var t = "dark";
  try {
    var s = localStorage.getItem("mx-theme");
    if (s === "light" || s === "dark") t = s;
  } catch (e) { /* storage blocked: stay on default */ }
  document.documentElement.setAttribute("data-theme", t);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", t === "light" ? "#ffffff" : "#101010");
})();
