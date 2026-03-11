const { JSDOM } = require("jsdom");
const dom = new JSDOM(`
  <form onsubmit="testSubmit(event)">
    <button type="submit" id="btn">Submit</button>
  </form>
  <script>
    window.result = false;
    function testSubmit(e) {
      e.preventDefault();
      window.result = true;
    }
  </script>
`, { runScripts: "dangerously" });
const window = dom.window;
window.document.getElementById('btn').click();
console.log("Was testSubmit called?", window.result);
