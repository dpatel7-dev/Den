# den

A cozy place to write code. Type `den` in a terminal and your project opens in
your browser as a full code editor: your files on the left, your code in the
middle, a console underneath, and Ember the fox on the right, explaining things
in plain words.

![den, with a web page open next to its live preview](docs/den.png)

It's made for people who are learning, so nothing is hidden behind settings:

- **Run** your code with one button. Python, JavaScript, and about a dozen
  more. What it prints shows in the console, and if it asks a question
  (`input()`), you answer in the box underneath.
- **When something breaks, Ember tells you what it means.** "Text and a number
  got mixed: turn the number into text first with `str(...)`", with a button
  that jumps to the right line. Missing a module? One button installs it.
- **"What's this?"** Put your cursor on a word like `for`, `def`,
  `querySelector` or `padding` and Ember explains it, with a tiny example.
- **Preview** web pages as you type, Markdown notes, SVG pictures and CSV
  tables. A web page's `console.log` and its errors show in den's console too.
- **Ask Ember** anything about your code. She can see the file you have open
  and what you selected, and answers with code you can **Put in file** (undo
  always works). She uses the free AI you set up in Tree of Thought.
- **Nothing gets lost.** den saves as you type, keeps earlier versions of every
  file, and deleting only moves things to den's bin, so you can put them back.

Part of the same family as [gossip](https://github.com/dpatel7-dev/gossip),
[Tree of Thought](https://github.com/dpatel7-dev/Tree-Of-Thought),
[pigeon](https://github.com/dpatel7-dev/pigeon),
[tidy](https://github.com/dpatel7-dev/tidy) and
[Project CLI Access](https://github.com/dpatel7-dev/Project-CLI-Access).
Its mascot is Ember, a fox (a den is where a fox lives).

## Install

The easiest way is Project CLI Access: type `pca`, pick **den**, press Enter.

Or on its own, on a Mac or Linux (Terminal):

```sh
curl -fsSL https://djp7.pythonanywhere.com/den/install.sh | sh
```

On Windows (PowerShell):

```powershell
irm https://djp7.pythonanywhere.com/den/install.ps1 | iex
```

If the website is blocked where you are, the same installer is on GitHub:

```sh
curl -fsSL https://raw.githubusercontent.com/dpatel7-dev/Den/main/install.sh | sh
```

den brings its own copy of Node.js if your computer doesn't have one, and
installs nothing else.

## Use it, step by step

1. Open a terminal.
2. Go to your project's folder. For example: `cd Documents/my-website`
   (or make a new one: `den my-first-project`, and den offers to make the folder).
3. Type `den` and press Enter.
4. den opens in its own window (or a browser tab). Keep the terminal open
   while you code: it's what den runs on. **Ctrl+C** in the terminal closes den.

Then:

- **Make a file:** press **+ file** at the top of the Files list. Name it
  `something.py` for Python, `index.html` for a web page, or `notes.md` for notes.
  An empty file? Ember offers a small example to start from.
- **Run it:** press **▶ Run** (or **⌘Enter** on a Mac, **Ctrl+Enter** on
  Windows). For a web page the button says **Preview** instead.
- **Find things:** **⌘P** finds a file by name, **⌘⇧F** searches every file,
  **⌘F** finds (and replaces) in the file you're in.
- **Everything else:** press **☰** (or **⌘K**) and type what you want, like
  "rename", "light" or "earlier versions". Press **?** to see all the keys.

On Windows, use **Ctrl** wherever this says **⌘**.

## Ember's AI (optional, free)

The "What's this?" help and the error explanations work without any AI. To
also ask Ember questions, set up free AI once in Tree of Thought:

1. Install Tree of Thought (type `pca` and pick it).
2. In a terminal, type `tot free` and follow the steps (it's copy and paste).
3. In den, open the **Ask** tab. That's it.

The AI runs in the cloud, so nothing heavy runs on your computer. Ember only
suggests: your files only change when you press **Put in file**, and **⌘Z**
undoes that.

## Running code

den runs the file you're on with the right program for its kind, from the
folder that file is in:

| Files | Needs |
| --- | --- |
| `.py` | Python ([python.org](https://www.python.org/downloads)) |
| `.js` | Node.js (den's installer brings one) |
| `.html` `.md` `.svg` `.csv` | nothing: they preview in den |
| `.sh` | Mac or Linux |
| `.ps1` | PowerShell (Windows) |
| `.rb` `.php` `.lua` `.go` `.java` `.swift` `.dart` `.r` `.pl` | that language installed |
| `.c` `.cpp` | a compiler (on a Mac: `xcode-select --install`) |

If something isn't installed, den says what to get and where. The box under
the console also runs any command, like `pip install requests` or `npm install`.

## Safe by design

- den only listens on your own computer, and its address has a long secret in
  it. Other websites you visit can't reach it, and it refuses requests that
  don't come from den's own page.
- It only touches files inside the folder you opened (links that point outside
  are refused too).
- Your web pages preview from a separate address, so a page can't reach den's
  controls.
- It never runs anything unless you press Run or type a command.
- Deleting moves things to den's bin (`~/.den/bin`), and every save keeps the
  version before it (`~/.den/history`, the newest 25 per file).

## Commands

```
den                  open the folder you're in
den <folder>         open that folder (den offers to make it if it isn't there)
den <file>           open the folder a file is in, showing that file
den update           get the newest version
den version          which version this is
den uninstall        remove den (add "all" to remove its bin and saved versions too)
den help             this list

--tab                a browser tab instead of den's own window
--no-open            just print the address
--port <n>           use this port
```

## For developers

Zero dependencies: Node.js 18 or newer, nothing from npm. The page is plain
HTML, CSS and JavaScript in `web/` (the editor is a textarea under a coloured
copy of the text; `web/highlight.js` colours about 25 languages).

```sh
node bin/den.js ~/some/project     # try it
node --test                        # the tests
```

MIT licence.
