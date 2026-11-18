// Ember's built-in help, no internet needed:
//  - what common words in code mean (the "What's this?" card follows your cursor)
//  - what common error messages mean, in plain words
//  - starting points for empty files
(function (root) {
  'use strict';

  // word: [what it means, a tiny example]
  var GLOSSARY = {
    python: {
      print: ['Shows something in the console below.', 'print("Hello!")'],
      input: ['Asks the person running the program to type something, and gives back what they typed (always as text).', 'name = input("Your name? ")'],
      def: ['Makes a function: a named set of steps you can run again and again.', 'def greet(name):\n    print("Hi", name)'],
      return: ['Ends a function and hands a value back to whoever called it.', 'def double(x):\n    return x * 2'],
      if: ['Runs the indented lines only when something is true.', 'if age >= 13:\n    print("Teen!")'],
      elif: ['Short for "else if": checked only when the if above it was false.', 'elif age >= 5:'],
      else: ['Runs when none of the if/elif checks above were true.', 'else:\n    print("Something else")'],
      for: ['Repeats the indented lines once for each item in a list (or each number in a range).', 'for fruit in ["apple", "pear"]:\n    print(fruit)'],
      while: ['Keeps repeating the indented lines as long as something stays true.', 'while lives > 0:'],
      in: ['Checks whether something is inside a list or text, or walks through items in a for loop.', '"a" in "cat"   # True'],
      range: ['Makes a row of numbers. range(5) is 0, 1, 2, 3, 4.', 'for i in range(5):'],
      import: ['Brings in code someone else wrote (a module), so you can use it.', 'import random'],
      from: ['Brings in just one part of a module.', 'from random import randint'],
      class: ['A blueprint for making objects that have their own data and actions.', 'class Dog:\n    def bark(self):\n        print("Woof")'],
      self: ['Inside a class, self means "this particular object".', 'self.name = name'],
      True: ['Yes / on. One of the two true-or-false values.', 'done = True'],
      False: ['No / off. One of the two true-or-false values.', 'done = False'],
      None: ['"Nothing here." A value that means there is no value.', 'result = None'],
      and: ['True only when both sides are true.', 'if hungry and has_food:'],
      or: ['True when at least one side is true.', 'if rain or snow:'],
      not: ['Flips true to false and false to true.', 'if not done:'],
      try: ['Tries some code, and if it fails, runs the except part instead of crashing.', 'try:\n    n = int(text)\nexcept ValueError:\n    print("Not a number")'],
      except: ['What to do when the code in try fails.', 'except ValueError:'],
      with: ['Opens something (like a file) and closes it for you when the indented part is done.', 'with open("notes.txt") as f:\n    text = f.read()'],
      open: ['Opens a file so you can read it or write to it.', 'open("notes.txt", "w")'],
      len: ['How many items are in a list, or letters in some text.', 'len("hello")   # 5'],
      list: ['A list holds several things in order, in square brackets.', 'pets = ["cat", "dog"]'],
      dict: ['A dictionary holds pairs: a key and its value.', 'ages = {"maya": 13}'],
      append: ['Adds an item to the end of a list.', 'pets.append("fish")'],
      int: ['Turns text (or a decimal) into a whole number.', 'int("42")   # 42'],
      str: ['Turns something into text.', 'str(42)   # "42"'],
      float: ['Turns something into a decimal number.', 'float("3.5")'],
      break: ['Stops a loop straight away.', 'break'],
      continue: ['Skips the rest of this time around the loop and moves on to the next item.', 'continue'],
      pass: ['"Do nothing." A placeholder where Python needs at least one line.', 'def later():\n    pass'],
      lambda: ['A tiny function written on one line, with no name.', 'square = lambda x: x * x'],
      random: ['A module for random numbers and picks. Use it after: import random', 'random.randint(1, 6)'],
    },
    javascript: {
      const: ['Makes a name for a value that won\'t be swapped for a different one later.', 'const name = "Maya";'],
      let: ['Makes a name for a value that can change later.', 'let score = 0;\nscore = score + 1;'],
      var: ['The old way to make a variable. let and const are clearer, so use those.', 'var x = 1;'],
      function: ['Makes a function: a named set of steps you can run again and again.', 'function greet(name) {\n  return "Hi " + name;\n}'],
      return: ['Ends a function and hands a value back.', 'return total;'],
      if: ['Runs the code in { } only when something is true.', 'if (score > 10) { ... }'],
      else: ['Runs when the if check was false.', '} else { ... }'],
      for: ['Repeats the code in { }, usually once for each item or number.', 'for (const pet of pets) { ... }'],
      while: ['Keeps repeating while something stays true.', 'while (lives > 0) { ... }'],
      console: ['The console is where messages from your code show up.', 'console.log("Hello!");'],
      log: ['console.log shows something in the console, which is great for checking what your code is doing.', 'console.log(score);'],
      document: ['The web page itself. Use it to find and change things on the page.', 'document.querySelector("h1")'],
      querySelector: ['Finds the first thing on the page that matches, like "#title" or ".card".', 'document.querySelector("#title")'],
      addEventListener: ['Runs your function when something happens, like a click.', 'button.addEventListener("click", () => { ... });'],
      async: ['Marks a function that can wait for slow things (like loading data) without freezing the page.', 'async function load() { ... }'],
      await: ['Waits for a slow thing to finish, inside an async function.', 'const res = await fetch(url);'],
      fetch: ['Gets something from the internet (or a file next to your page).', 'fetch("data.json")'],
      class: ['A blueprint for making objects with their own data and actions.', 'class Dog { bark() { ... } }'],
      new: ['Makes a new object from a class.', 'const d = new Dog();'],
      this: ['Inside a class or object, "this" means the object itself.', 'this.name = name;'],
      true: ['Yes / on.', 'let done = true;'],
      false: ['No / off.', 'let done = false;'],
      null: ['"Nothing here", on purpose.', 'let winner = null;'],
      undefined: ['"Nothing has been put here yet."', 'let x;   // undefined'],
      import: ['Brings in code from another file or package.', 'import { add } from "./math.js";'],
      export: ['Lets other files use something from this file.', 'export function add(a, b) { ... }'],
      Math: ['Built-in maths helpers.', 'Math.round(2.6)   // 3'],
      JSON: ['Turns data into text and back.', 'JSON.stringify({ a: 1 })'],
      setTimeout: ['Runs a function once, after a delay in milliseconds.', 'setTimeout(() => alert("hi"), 1000);'],
      length: ['How many items in a list, or letters in some text.', '"hello".length   // 5'],
      push: ['Adds an item to the end of a list.', 'pets.push("fish");'],
      require: ['Brings in another file or package (in Node.js).', 'const fs = require("fs");'],
    },
    html: {
      html: ['Wraps the whole page.', '<html> ... </html>'],
      head: ['Information about the page (its title, styles), not shown on the page itself.', '<head> ... </head>'],
      body: ['Everything you see on the page goes in here.', '<body> ... </body>'],
      title: ['The text in the browser tab.', '<title>My page</title>'],
      h1: ['The biggest heading. h2 to h6 are smaller ones.', '<h1>Welcome!</h1>'],
      p: ['A paragraph of text.', '<p>Hello there.</p>'],
      a: ['A link. href says where it goes.', '<a href="about.html">About me</a>'],
      img: ['A picture. src says which file; alt describes it for people who can\'t see it.', '<img src="cat.png" alt="My cat">'],
      div: ['A box for grouping other things, often styled with CSS.', '<div class="card"> ... </div>'],
      span: ['Like div, but for a bit of text in the middle of a line.', '<span class="big">wow</span>'],
      ul: ['A list with bullet points. Each item is an <li>.', '<ul><li>One</li><li>Two</li></ul>'],
      ol: ['A numbered list. Each item is an <li>.', '<ol><li>First</li></ol>'],
      li: ['One item in a list.', '<li>Milk</li>'],
      button: ['A button people can click. JavaScript decides what it does.', '<button id="go">Go!</button>'],
      input: ['A box people can type in (or a checkbox, slider...).', '<input type="text" placeholder="Your name">'],
      form: ['Groups inputs together so they can be sent somewhere.', '<form> ... </form>'],
      script: ['Where JavaScript goes (or a link to a .js file).', '<script src="app.js"></script>'],
      style: ['Where CSS goes, right inside the page.', '<style> h1 { color: red; } </style>'],
      link: ['Connects another file to the page, usually a CSS file.', '<link rel="stylesheet" href="style.css">'],
      meta: ['Extra information for the browser, like which characters the page uses.', '<meta charset="utf-8">'],
      class: ['A name you give things so CSS (or JavaScript) can find them. Many things can share a class.', '<p class="note">'],
      id: ['A unique name for one thing on the page.', '<h1 id="title">'],
      href: ['Where a link goes.', 'href="https://example.com"'],
      src: ['Which file to use (for pictures and scripts).', 'src="cat.png"'],
    },
    css: {
      color: ['The colour of the text.', 'color: tomato;'],
      background: ['What\'s behind something: a colour, or a picture.', 'background: #222;'],
      margin: ['Space outside a box, pushing other things away.', 'margin: 16px;'],
      padding: ['Space inside a box, between its edge and its content.', 'padding: 8px 16px;'],
      border: ['A line around a box: thickness, style and colour.', 'border: 2px solid black;'],
      display: ['How a box sits on the page. flex and grid lay out the things inside it.', 'display: flex;'],
      flex: ['With display: flex, things inside sit in a row (or column) and share the space.', 'display: flex; gap: 8px;'],
      grid: ['With display: grid, things inside line up in rows and columns.', 'display: grid; grid-template-columns: 1fr 1fr;'],
      gap: ['Space between the things inside a flex or grid box.', 'gap: 12px;'],
      width: ['How wide something is.', 'width: 300px;'],
      height: ['How tall something is.', 'height: 100vh;'],
      'font-size': ['How big the text is.', 'font-size: 20px;'],
      'font-family': ['Which font the text uses.', 'font-family: Georgia, serif;'],
      position: ['How a box is placed: relative, absolute (exactly where you say), fixed (stays put when scrolling).', 'position: absolute; top: 0;'],
      'justify-content': ['In flex, where things go along the row: start, center, end, space-between.', 'justify-content: center;'],
      'align-items': ['In flex, where things go up-and-down.', 'align-items: center;'],
      'border-radius': ['Rounds the corners.', 'border-radius: 12px;'],
      'text-align': ['Lines text up on the left, centre or right.', 'text-align: center;'],
    },
  };
  GLOSSARY.typescript = GLOSSARY.javascript;

  // What you see when the file is empty: a starting point.
  var STARTERS = {
    html: '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My page</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello!</h1>\n  <p>This is my page.</p>\n  <script src="script.js"></script>\n</body>\n</html>\n',
    python: '# My program\n\nname = input("What\'s your name? ")\nprint(f"Hi {name}! Welcome to your den.")\n',
    javascript: '// My program\n\nconst name = "world";\nconsole.log(`Hello, ${name}!`);\n',
    css: 'body {\n  font-family: system-ui, sans-serif;\n  margin: 40px;\n  background: #fdf8f0;\n  color: #2a211b;\n}\n\nh1 {\n  color: #d9692a;\n}\n',
    markdown: '# My notes\n\nWrite things down here. **Bold**, *italic*, and lists:\n\n- one\n- two\n',
  };

  // ── errors, in plain words ──────────────────────────────────────────
  var PIP = { cv2: 'opencv-python', PIL: 'pillow', sklearn: 'scikit-learn', bs4: 'beautifulsoup4', yaml: 'pyyaml', dotenv: 'python-dotenv', serial: 'pyserial', Crypto: 'pycryptodome' };
  var codeOf = function (s) { return '<code>' + String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</code>'; };

  // [pattern, title, explain(m) -> html, fix(m) -> { command } (optional)]
  var ERRORS = [
    [/ModuleNotFoundError: No module named '([\w.]+)'/, 'A module is missing', function (m) {
      var pkg = PIP[m[1].split('.')[0]] || m[1].split('.')[0];
      return 'This program uses ' + codeOf(m[1]) + ', which isn\'t installed on this computer yet. Install it with the command below, then press Run again.';
    }, function (m, os) { var pkg = PIP[m[1].split('.')[0]] || m[1].split('.')[0]; return { command: (os === 'win32' ? 'py -m pip install ' : 'python3 -m pip install ') + pkg }; }],
    [/NameError: name '(\w+)' is not defined/, 'Python doesn\'t know that name', function (m) {
      return 'Python doesn\'t know what ' + codeOf(m[1]) + ' is. Check the spelling (capital letters count), and make sure it gets a value, like ' + codeOf(m[1] + ' = ...') + ', before this line uses it. If it\'s text, it needs quotes: ' + codeOf('"' + m[1] + '"') + '.';
    }],
    [/IndentationError: (.*)/, 'The spaces at the start of a line are off', function (m) {
      return 'Python uses the spaces at the start of a line to know what belongs together. ' + (/expected an indented block/.test(m[1]) ? 'After a line ending in a colon (:), the next line needs to be indented (pushed in with Tab).' : /unindent|unexpected indent/.test(m[1]) ? 'This line is pushed in more (or less) than the lines around it. Make it line up with the others.' : 'Make the lines inside an if, for or def line up with each other.');
    }],
    [/TabError/, 'Tabs and spaces are mixed', function () { return 'Some lines are pushed in with tabs and some with spaces, and Python can\'t tell how they line up. Re-indent those lines with Tab in den (it uses spaces).'; }],
    [/SyntaxError: (.*)/, 'Python couldn\'t read a line', function (m) {
      var why = m[1];
      var tip = /was never closed|EOF/.test(why) ? 'A bracket or quote was opened but never closed. Count your ( ), [ ], { } and quotes.'
        : /expected ':'/.test(why) ? 'Lines that start with if, for, while, def or class need a colon (:) at the end.'
          : /unterminated string|EOL while scanning/.test(why) ? 'Some text is missing its closing quote.'
            : /invalid syntax\. Perhaps you forgot a comma/.test(why) ? 'It looks like a comma is missing between two things in a list or a function call.'
              : /Missing parentheses in call to 'print'/.test(why) ? 'In Python 3, print needs brackets: print("hi").'
                : /'=' .* '=='|cannot assign/.test(why) ? 'To check if two things are equal, use == (two equals signs). One = gives something a value.'
                  : 'Look closely at the line it points to, and the one just before it: a missing bracket, quote, comma or colon is the usual reason.';
      return tip;
    }],
    [/TypeError: can only concatenate str \(not "(\w+)"\) to str/, 'Text and a number got mixed', function (m) {
      return 'You\'re joining text with a ' + codeOf(m[1]) + '. Turn it into text first with ' + codeOf('str(...)') + ', or use an f-string: ' + codeOf('f"Score: {score}"') + '.';
    }],
    [/TypeError: unsupported operand type\(s\) for ([^:]+): '(\w+)' and '(\w+)'/, 'Those two can\'t be combined', function (m) {
      return 'You used ' + codeOf(m[1].trim()) + ' on a ' + codeOf(m[2]) + ' and a ' + codeOf(m[3]) + '. If one of them came from input(), it\'s text: turn it into a number with ' + codeOf('int(...)') + ' first.';
    }],
    [/TypeError: '(\w+)' object is not callable/, 'Something isn\'t a function', function (m) { return 'Brackets after a name, like ' + codeOf('x()') + ', run it as a function, but this is a ' + codeOf(m[1]) + '. Maybe a variable has the same name as a function?'; }],
    [/TypeError: (\w+)\(\) (missing \d+ required positional argument|takes \d+ positional argument)/, 'The wrong number of things were passed in', function (m) { return codeOf(m[1] + '()') + ' was given a different number of values than it expects. Compare the call with its def line.'; }],
    [/ZeroDivisionError/, 'Dividing by zero', function () { return 'Something was divided by 0, which has no answer. Check the number you divide by isn\'t 0 first.'; }],
    [/IndexError: (list|string|tuple) index out of range/, 'Past the end of the list', function (m) { return 'You asked for an item that isn\'t there: the ' + m[1] + ' is shorter than that. Remember counting starts at 0, so the last item of a 3-item list is [2].'; }],
    [/KeyError: (.*)/, 'That key isn\'t in the dictionary', function (m) { return 'The dictionary has no ' + codeOf(m[1]) + '. Check the spelling, or use ' + codeOf('.get(key)') + ' to get None instead of an error.'; }],
    [/ValueError: invalid literal for int\(\) with base 10: '(.*)'/, 'That text isn\'t a whole number', function (m) { return codeOf('int()') + ' got ' + codeOf("'" + m[1] + "'") + ', which isn\'t a whole number. If someone types it, check it first (or use try/except).'; }],
    [/AttributeError: '(\w+)' object has no attribute '(\w+)'/, 'That doesn\'t have that', function (m) { return 'A ' + codeOf(m[1]) + ' has no ' + codeOf('.' + m[2]) + '. Check the spelling, or whether the value is the kind you think it is (print it to see).'; }],
    [/FileNotFoundError: .*No such file or directory: '(.*)'/, 'File not found', function (m) { return 'There\'s no file called ' + codeOf(m[1]) + ' where the program looked. den runs a file from the folder it\'s in, so a name on its own means "next to this file".'; }],
    [/RecursionError/, 'A function called itself forever', function () { return 'A function keeps calling itself and never stops. Make sure it has a case where it returns without calling itself again.'; }],
    [/EOFError: EOF when reading a line/, 'The program was waiting for you to type', function () { return 'input() was waiting for an answer, but none came. Type your answer in the box under the console and press Enter.'; }],
    [/ReferenceError: (\S+) is not defined/, 'JavaScript doesn\'t know that name', function (m) { return 'JavaScript doesn\'t know what ' + codeOf(m[1]) + ' is. Check the spelling (capitals count), and make sure you made it with ' + codeOf('let') + ' or ' + codeOf('const') + ' first.' + (/^(document|window|alert)$/.test(m[1]) ? ' (' + codeOf(m[1]) + ' only exists in a web page, not when running a file with Node.js. Put this script in an HTML page and use Preview.)' : ''); }],
    [/TypeError: Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '(.*)'\))?/, 'Something was empty', function (m) { return 'You asked for ' + (m[2] ? codeOf('.' + m[2]) : 'a property') + ' of something that is ' + codeOf(m[1]) + '. The thing before the dot doesn\'t exist yet: maybe a typo, or a page element that wasn\'t found.'; }],
    [/TypeError: (\S+) is not a function/, 'That isn\'t a function', function (m) { return codeOf(m[1]) + ' was called like a function, but it isn\'t one. Check the spelling.'; }],
    [/Error: Cannot find module '([^']+)'/, 'A package is missing', function (m) { return /^[./]/.test(m[1]) ? 'There\'s no file at ' + codeOf(m[1]) + '. Check the path and the spelling.' : 'This program uses the package ' + codeOf(m[1]) + ', which isn\'t installed in this folder. Install it with the command below.'; }, function (m) { return /^[./]/.test(m[1]) ? null : { command: 'npm install ' + m[1].split('/').slice(0, m[1][0] === '@' ? 2 : 1).join('/') }; }],
    [/SyntaxError: (Unexpected .*|missing .*|Invalid .*|Unterminated .*)/, 'JavaScript couldn\'t read a line', function (m) { return 'JavaScript got confused here: ' + codeOf(m[1]) + '. Look for a missing bracket, quote or comma on that line or just before it.'; }],
    [/command not found|is not recognized as an internal or external command/, 'That program isn\'t installed', function () { return 'The computer couldn\'t find that program. It may not be installed, or the name may be misspelled.'; }],
    [/Permission denied|EACCES/, 'Not allowed', function () { return 'The computer said no: this file or folder is protected. Try a different folder.'; }],
  ];

  /** Where the problem is: { path, line } (the last place mentioned in the output). */
  function place(output) {
    var m, last = null, re;
    re = /File "([^"]+)", line (\d+)/g;
    while ((m = re.exec(output))) last = { path: m[1], line: +m[2] };
    if (last) return last;
    re = /(?:^|\(|\s)((?:[A-Za-z]:)?[^\s():]+\.(?:js|mjs|cjs|ts|rb|go|java|php|lua|swift|c|cpp|rs)):(\d+)(?::(\d+))?/m;
    m = output.match(re);
    if (m) return { path: m[1], line: +m[2], col: m[3] ? +m[3] : 1 };
    return null;
  }

  /** A failed run's output -> { title, html, fix, where } or null. */
  function explain(output, os) {
    var text = String(output || '');
    for (var k = 0; k < ERRORS.length; k++) {
      var m = text.match(ERRORS[k][0]);
      if (m) return { title: ERRORS[k][1], html: ERRORS[k][2](m), fix: ERRORS[k][3] ? ERRORS[k][3](m, os) : null, where: place(text) };
    }
    return null;
  }

  // Little projects to start from (the welcome page's examples): { file: text }
  var TEMPLATES = {
    web: {
      'index.html': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My page</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main>\n    <h1>Hello!</h1>\n    <p>This is my page. Change this text and watch the preview.</p>\n    <button id="clicker">Click me</button>\n    <p id="count">No clicks yet.</p>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>\n',
      'style.css': 'body {\n  font-family: system-ui, sans-serif;\n  background: #fdf6ee;\n  color: #2b2118;\n  margin: 0;\n}\n\nmain {\n  max-width: 40rem;\n  margin: 4rem auto;\n  padding: 0 1.5rem;\n}\n\nh1 {\n  color: #e0662f;\n}\n\nbutton {\n  font: inherit;\n  padding: 0.6rem 1.2rem;\n  border: 0;\n  border-radius: 999px;\n  background: #e0662f;\n  color: white;\n  cursor: pointer;\n}\n',
      'script.js': '// This runs in the page. console.log() shows in den\'s console.\nconst button = document.getElementById("clicker");\nconst count = document.getElementById("count");\nlet clicks = 0;\n\nbutton.addEventListener("click", () => {\n  clicks = clicks + 1;\n  count.textContent = "Clicked " + clicks + " times.";\n  console.log("clicked", clicks);\n});\n',
    },
    py: {
      'main.py': '# A tiny Python program. Press Run to try it.\n\nname = input("What is your name? ")\nprint("Hi, " + name + "!")\n\nage = int(input("How old are you? "))\nprint("In ten years you will be", age + 10)\n\nfor n in range(1, 4):\n    print(n, "x 7 =", n * 7)\n',
    },
    quiz: {
      'quiz.py': '# A quiz game. Add your own questions to the list!\n\nquestions = [\n    ("What is 7 x 8?", "56"),\n    ("What colour do you get by mixing blue and yellow?", "green"),\n    ("How many legs does a spider have?", "8"),\n]\n\nscore = 0\nfor question, answer in questions:\n    guess = input(question + " ")\n    if guess.strip().lower() == answer:\n        print("Right!")\n        score = score + 1\n    else:\n        print("Not quite. It was", answer)\n\nprint("You got", score, "out of", len(questions))\n',
    },
    game: {
      'index.html': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>Star catcher</title>\n  <style>\n    body { margin: 0; background: #14101c; display: grid; place-items: center; height: 100vh; font-family: system-ui, sans-serif; color: #f4ecff; }\n    canvas { background: #1f1830; border-radius: 12px; }\n  </style>\n</head>\n<body>\n  <div>\n    <p>Use the arrow keys to catch the stars. Score: <b id="score">0</b></p>\n    <canvas id="game" width="480" height="320"></canvas>\n  </div>\n  <script src="game.js"></script>\n</body>\n</html>\n',
      'game.js': '// Star catcher: move the square with the arrow keys and catch the stars.\nconst canvas = document.getElementById("game");\nconst ctx = canvas.getContext("2d");\nconst scoreText = document.getElementById("score");\n\nconst player = { x: 220, y: 280, size: 26, speed: 5 };\nlet star = newStar();\nlet score = 0;\nconst keys = {};\n\naddEventListener("keydown", (e) => { keys[e.key] = true; });\naddEventListener("keyup", (e) => { keys[e.key] = false; });\n\nfunction newStar() {\n  return { x: 20 + Math.random() * 440, y: -10, speed: 2 + Math.random() * 2 };\n}\n\nfunction update() {\n  if (keys.ArrowLeft) player.x -= player.speed;\n  if (keys.ArrowRight) player.x += player.speed;\n  player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));\n\n  star.y += star.speed;\n  const caught = star.y > player.y && star.x > player.x && star.x < player.x + player.size;\n  if (caught) {\n    score = score + 1;\n    scoreText.textContent = score;\n    star = newStar();\n  } else if (star.y > canvas.height) {\n    star = newStar();\n  }\n}\n\nfunction draw() {\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = "#ff8a4c";\n  ctx.fillRect(player.x, player.y, player.size, player.size);\n  ctx.fillStyle = "#ffd86b";\n  ctx.beginPath();\n  ctx.arc(star.x, star.y, 7, 0, Math.PI * 2);\n  ctx.fill();\n}\n\nfunction loop() {\n  update();\n  draw();\n  requestAnimationFrame(loop);\n}\nloop();\n',
    },
    notes: {
      'notes.md': '# My notes\n\nWrite anything here. Press **Preview** to see it formatted.\n\n## To do\n\n- [x] Open den\n- [ ] Make something\n- [ ] Show someone\n\n## Ideas\n\n1. A game\n2. A website about my hobby\n\n> Tip: a line starting with # is a heading.\n',
    },
  };

  var api = { GLOSSARY: GLOSSARY, STARTERS: STARTERS, TEMPLATES: TEMPLATES, explain: explain, place: place };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HELP = api;
})(this);
