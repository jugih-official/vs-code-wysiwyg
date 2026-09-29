Firstly, if You like my work and it really helped you, please consider buying me a coffee (beer). 
Much obliged!
<br>
<br>
&nbsp;&nbsp;&nbsp;
<a href="https://www.buymeacoffee.com/jugih" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
<br>
<a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=WGY835R5UWSRA">
  <img src="https://raw.githubusercontent.com/jugih-official/vs-code-wysiwyg/master/paypal-donate-button.png" alt="Donate with PayPal" style="height: 100px !important;" />
</a>


# Universal all-in-one XAML / AXAML / Razor / HTML / Vue / React Visual Designer for VS Code

A VS Code extension that provides a full **WYSIWYG visual designer** for `.xaml`, `.axaml`, `.razor`, `.html`, `.htm`, `.vue`, `.jsx`, and `.tsx` files.  
Design UIs by dragging controls onto a canvas — no hand-editing markup required. Changes sync back to the source file automatically. <br> <br>
Now on Vs Code marketplace:<br>
https://marketplace.visualstudio.com/items?itemName=jugih-official.wysiwyg-designer

---

## License Notice

This project is source-available.

Forking, redistribution, publishing modified versions,
or republishing this extension in any marketplace is
strictly prohibited without explicit permission from
the author.

See the LICENSE file for full terms.

---

## Table of Contents

1. [Overview](#overview)
2. [Features at a Glance](#features-at-a-glance)
3. [Prerequisites](#prerequisites)
4. [Compile & Package from Source](#compile--package-from-source)
   - [Quick Start](#quick-start)
   - [Step-by-step Breakdown](#step-by-step-breakdown)
5. [Install the Extension](#install-the-extension)
   - [Install from VSIX File](#install-from-vsix-file)
   - [Run in Extension Development Host](#run-in-extension-development-host)
6. [Using the Designers](#using-the-designers)
   - [Opening a Designer](#opening-a-designer)
   - [Designer Layout](#designer-layout)
   - [Working with Controls](#working-with-controls)
   - [Zoom & Pan](#zoom--pan)
   - [Bidirectional Cursor Sync](#bidirectional-cursor-sync)
   - [Syncing Changes to Source](#syncing-changes-to-source)
7. [WPF Designer](#wpf-designer)
8. [XAML / AXAML Designer](#xaml--axaml-designer)
   - [Available Controls](#xaml-available-controls)
   - [Control Nesting](#control-nesting)
   - [Properties Panel — XAML](#properties-panel--xaml)
9. [Razor Designer](#razor-designer)
10. [HTML Designer](#html-designer)
11. [Vue Designer](#vue-designer)
    - [Available Elements](#vue-available-elements)
    - [Properties Panel — Vue](#properties-panel--vue)
12. [React Designer](#react-designer)
    - [Available Elements](#react-available-elements)
    - [Properties Panel — React](#properties-panel--react)
13. [Live Preview](#live-preview)
    - [HTML Preview](#html-preview)
    - [XAML / AXAML Preview](#xaml--axaml-preview)
    - [Razor Preview](#razor-preview)
14. [Keyboard Shortcuts](#keyboard-shortcuts)
15. [Toolbar Reference](#toolbar-reference)
16. [Context Menu Reference](#context-menu-reference)
17. [Development Guide](#development-guide)
18. [Project Structure](#project-structure)

---

## Overview

**XAML/AXAML/Razor/HTML/Vue/React Visual Designer** is a VS Code custom editor extension that replaces the raw text view of markup files with an interactive design canvas. It is aimed at developers working with:

| File Type | Framework / Use-case |
|-----------|---------------------|
| `.xaml` / `.axaml` | Avalonia UI (WPF-like cross-platform UI framework) |
| `.razor` | Blazor (ASP.NET Core component model) |
| `.html` / `.htm` | Plain HTML / static web pages |
| `.vue` | Vue.js Single File Components |
| `.jsx` / `.tsx` | React / React + TypeScript components |

The extension is read-write: it parses the existing markup into a visual representation and can write the resulting layout back to disk as valid, formatted markup.

---

## Features at a Glance

| Feature | Details |
|---------|---------|
| **Drag-and-drop toolbox** | 50+ XAML controls, 18 Blazor components, 60+ HTML elements (shared across HTML, Vue, and React designers) |
| **Visual canvas** | Absolute-positioned drag surface with pixel-accurate placement |
| **Resize handles** | 8-point handles (4 corners + 4 edges) on every selected control |
| **Resizable panes** | Drag the splitter borders between the Toolbox, Canvas, and Properties panels to resize them |
| **Properties panel** | Dynamic panel showing all editable attributes for the selected control |
| **Undo / Redo** | Full per-session undo stack (up to 50 entries) — Ctrl+Z / Ctrl+Y |
| **Keyboard control** | Delete, Duplicate, Arrow-key nudging (1 px / 10 px with Shift), Escape |
| **Z-order management** | Bring to Front / Send to Back per control |
| **Context menu** | Right-click any control for common operations |
| **Auto-sync** | Visual changes are written back to the source file automatically after a 300 ms idle period; a pulsing badge in the toolbar confirms each sync |
| **Bi-directional sync** | External file edits update the canvas automatically |
| **Bidirectional cursor sync** | Clicking a control in the designer highlights the matching element in the text editor, and moving the text-editor cursor highlights the matching control on the canvas |
| **Zoom & Pan** | Ctrl+Scroll to zoom the canvas (10%–500%); middle-mouse-button drag to pan; click the zoom badge to reset to 100% |
| **Control nesting** | Container controls accept child controls via drag-and-drop in all designers (XAML, Razor, HTML, Vue, React), producing proper parent–child markup. Hold Alt while releasing a dragged control to nest/un-nest. |
| **Five designer modes** | Separate, purpose-built designers for XAML, Razor, HTML, Vue, and React |
| **HTML Live Preview** | Preview HTML files in a side panel inside VS Code with auto-refresh |
| **XAML / Razor Preview** | Preview XAML/AXAML and Razor files with approximate HTML rendering in a side panel |
| **Explorer context menu** | Right-click files in the Explorer to open directly with the designer |

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| [VS Code](https://code.visualstudio.com/) | 1.80.0 or later |
| [Node.js](https://nodejs.org/) | 18.x or later (for compiling from source) |
| npm | Included with Node.js |
| [TypeScript](https://www.typescriptlang.org/) | Installed locally via `npm install` |

---

## Compile & Package from Source

### Quick Start

```bash
git clone https://github.com/jugih-official/vs-code-wysiwyg.git
cd vs-code-wysiwyg
npm install
npm run compile
npm run package
code --install-extension xaml-axaml-designer-x.z.y.vsix
```

That's it!

### Step-by-step Breakdown

#### 1. Clone the Repository

```bash
git clone https://github.com/jugih-official/vs-code-wysiwyg.git
cd vs-code-wysiwyg
```

#### 2. Install Dependencies

```bash
npm install
```

This installs TypeScript, the VS Code type definitions, and `@vscode/vsce` (the VS Code Extension packager).

#### 3. Compile TypeScript

```bash
npm run compile
```

The compiler reads `tsconfig.json` and outputs JavaScript to the `out/` directory.  
The entry point for the extension is `out/extension.js`.

> **Watch mode** — during active development you can run `npm run watch` instead.  
> This keeps the TypeScript compiler running in the background and recompiles on every save.

#### 4. Package as VSIX

```bash
npm run package
```

After a successful run you will find a `.vsix` file in the project root, e.g. `xaml-axaml-designer-0.1.0.vsix`.

---

## Install the Extension

### Install from VSIX File

1. Open VS Code.
2. Open the **Extensions** view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Click the **`···`** (More Actions) button at the top-right of the Extensions panel.
4. Select **Install from VSIX…**
5. Navigate to the `.vsix` file produced in the previous step and click **Install**.
6. Reload VS Code when prompted.

Alternatively, install via the command line:

```bash
code --install-extension xaml-axaml-designer-x.y.z.vsix
```

### Run in Extension Development Host

For development and testing without packaging, press **F5** in VS Code with the repository open. VS Code will launch a second window — the *Extension Development Host* — with the extension loaded from source.

---

## Using the Designers

### Opening a Designer

Each designer is registered as a **Custom Editor** with `"priority": "option"`, meaning it never overrides the default text editor.  
There are three ways to open the visual designer:

#### 1. Open With… Button

1. Open any supported file in VS Code.
2. Click the **"Open With…"** button in the editor title bar (the split-screen icon), **or** right-click the file in the Explorer and choose **Open With…**.
3. Select the appropriate designer from the list:
   - `XAML/AXAML Visual Designer` — for `.xaml` / `.axaml` files
   - `Razor Visual Designer` — for `.razor` files
   - `HTML Visual Designer` — for `.html` / `.htm` files
   - `Vue Visual Designer` — for `.vue` files
   - `React Visual Designer` — for `.jsx` / `.tsx` files

#### 2. File Explorer Context Menu

Right-click any supported file in the **Explorer** file tree to see the relevant designer command directly in the context menu:

- `.xaml` / `.axaml` → **Open with XAML Visual Designer** and **Preview XAML/AXAML in Side Panel**
- `.razor` → **Open with Razor Visual Designer** and **Preview Razor in Side Panel**
- `.html` / `.htm` → **Open with HTML Visual Designer** and **Preview HTML in Side Panel**
- `.vue` → **Open with Vue Visual Designer**
- `.jsx` / `.tsx` → **Open with React Visual Designer**

This allows you to open the designer without opening the file first.

#### 3. Command Palette

You can also run the corresponding command from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Action |
|---------|--------|
| `Open with XAML Visual Designer` | Opens the active `.xaml`/`.axaml` file in the XAML designer |
| `Open with Razor Visual Designer` | Opens the active `.razor` file in the Razor designer |
| `Open with HTML Visual Designer` | Opens the active `.html`/`.htm` file in the HTML designer |
| `Open with Vue Visual Designer` | Opens the active `.vue` file in the Vue designer |
| `Open with React Visual Designer` | Opens the active `.jsx`/`.tsx` file in the React designer |
| `Preview HTML in Side Panel` | Opens a live HTML preview beside the editor |
| `Preview XAML/AXAML in Side Panel` | Opens an approximate HTML preview of a XAML/AXAML file beside the editor |
| `Preview Razor in Side Panel` | Opens an approximate HTML preview of a Razor file beside the editor |

### Designer Layout

Every designer shares the same three-pane layout. Drag the splitter borders between panes to resize them:

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar  [↶ Undo] [↷ Redo] [🗑 Delete] [⬆ Front]      │
│           [⬇ Back]                    [● Auto-Sync]     │
├──────────────┬──────────────────────────┬───────────────┤
│              │                          │               │
│   Toolbox    │      Design Canvas       │  Properties   │
│              │                          │               │
│  (controls   │  (drag-and-drop surface) │  (selected    │
│   palette)   │                          │   control     │
│              │                          │   attributes) │
│              │                          │               │
└──────────────┴──────────────────────────┴───────────────┘
```

### Working with Controls

| Action | How to perform it |
|--------|-------------------|
| **Add a control** | Drag a control from the toolbox on the left and drop it onto the canvas |
| **Select a control** | Click it on the canvas — a blue border with resize handles appears |
| **Move a control** | Drag the selected control, or use the Arrow keys |
| **Resize a control** | Drag any of the 8 resize handles on the selection border |
| **Edit properties** | Select a control and modify the fields in the Properties panel on the right |
| **Delete a control** | Select it and press **Delete** or **Backspace**, or use the toolbar / context menu |
| **Duplicate a control** | Press **Ctrl+D**, or use the toolbar / context menu |
| **Undo last action** | Press **Ctrl+Z**, or click ↶ in the toolbar |
| **Redo last action** | Press **Ctrl+Y**, or click ↷ in the toolbar |
| **Deselect** | Press **Escape** or click on an empty area of the canvas |
| **Change z-order** | Use **Bring to Front** / **Send to Back** in the toolbar or context menu |
| **Zoom canvas** | Hold **Ctrl** and scroll the mouse wheel — zoom range is 10% to 500% |
| **Reset zoom** | Click the zoom-percentage badge in the toolbar to reset to 100% |
| **Pan canvas** | Hold the **middle mouse button** and drag |

### Zoom & Pan

The canvas supports smooth zoom and pan so you can work comfortably with large or complex layouts.

| Interaction | Action |
|-------------|--------|
| **Ctrl + Scroll wheel** | Zoom in / out — range 10% to 500% |
| **Click zoom badge** | Reset zoom to 100% |
| **Middle-mouse-button drag** | Pan the canvas in any direction |

All coordinate operations (drop, drag, resize) are automatically adjusted for the current zoom level, so controls are always placed at the correct pixel position regardless of how far you are zoomed in or out.

### Bidirectional Cursor Sync

The designers keep the visual canvas and the text editor in sync at all times:

- **Visual → Text**: Click a control on the canvas; the text editor jumps to the corresponding markup element and selects it.
- **Text → Visual**: Move the cursor (or click) in the text editor; the matching control on the canvas is highlighted with a coloured overlay.

This makes it easy to navigate between the visual representation and the raw markup without losing context.

### Syncing Changes to Source

Changes made on the canvas are written back to the source file **automatically**. After any visual operation (drag, resize, property edit, add, delete, undo/redo), a 300 ms debounce timer starts. When it expires, the designer serialises the current layout back to the markup file. A small **Auto-Sync** badge in the toolbar pulses briefly to confirm each sync.

The extension also listens for external file changes: if the `.xaml`, `.razor`, or `.html` file is edited in another editor tab, the canvas will refresh automatically.

---

## WPF Designer

A `.xaml` file whose root uses the WPF namespace (`http://schemas.microsoft.com/winfx/2006/xaml/presentation`) opens in the **WPF designer**. It draws the window the way WPF lays it out, so proportions and positions match the running application, and it edits the file in place without rewriting it.

**Rendering**
- WPF layout: `Canvas`, `Grid` (rows, columns, spans), `StackPanel`, `WrapPanel`, `DockPanel`, `UniformGrid`, `Border`, `Viewbox` (scaled like the running window) and the window frame (client area = `Width − 16` × `Height − 39`).
- The WPF value system: local attributes, `<X.Style>` and `Style="{StaticResource …}"` styles (with `BasedOn`), implicit styles by type, style triggers, resources and `SystemColors`.
- Design-time bindings behave as in the Visual Studio designer: a binding to another named element is evaluated, and every other binding shows its `FallbackValue`.
- Aero2 (Windows 10/11) looks for Button, TextBox, ProgressBar, CheckBox, ComboBox, Menu, StatusBar and TabControl, including custom `TabItem` and `MenuItem` templates. It also applies `#AARRGGBB` colours, transforms, blur and drop-shadow effects, and fonts with WPF line spacing (Selawik and Carlito stand in for Segoe UI and Calibri where those are not installed).
- Images resolve from the project root (the folder with the `.csproj`), so `/Resources/Images/x.png` works, and are sized in WPF units from their DPI.

**Editing**
- Every change is a minimal text edit, applied through VS Code: comments, formatting, styles and triggers you do not touch stay exactly as they are. Undo and redo use the normal editor history.
- Drag to move: this changes `Canvas.Left`/`Canvas.Top` in a Canvas, or `Margin` elsewhere, respecting the alignment. Handles resize by changing `Width`/`Height`. Arrow keys nudge (Shift for 10).
- The properties panel shows local values in bold, values from a style in yellow, and inherited or default values as placeholders. It edits any attribute and can add new ones.
- The Outline tree and its search find any element, including hidden ones. **Outlines** frames every element and shows hidden and unfilled ones, so they can be picked on the canvas.
- Click a tab header to show that tab. Ctrl+click steps through the elements stacked under the pointer; Alt+click selects the parent; Esc selects the parent.
- Toolbox: drag a control onto a Canvas, Grid, StackPanel or empty Border. Ctrl+D duplicates the selection (names get `_Copy`); Delete removes it.
- Selecting in the designer selects the element's start tag in an open text editor, and moving the cursor in the text selects the element. Double-click an element to open its source.

## XAML / AXAML Designer

Avalonia (`.axaml`, or `.xaml` without the WPF namespace) opens in this designer. It generates **Avalonia UI**-compatible XAML markup.  
All control coordinates are expressed as `Canvas.Left` / `Canvas.Top` absolute positions with explicit `Width` and `Height` attributes.

### XAML Available Controls

#### Common Controls

| Control | Description |
|---------|-------------|
| Button | Clickable button |
| TextBlock | Read-only text label |
| TextBox | Editable single-line text input |
| Label | Labelling element |
| CheckBox | Boolean checkbox |
| RadioButton | Exclusive selection in a group |
| ToggleSwitch | On/off toggle |
| ComboBox | Drop-down selection list |
| ListBox | Scrollable list of items |
| Slider | Range-value slider |
| ProgressBar | Progress indicator |
| Image | Displays a bitmap or vector image |
| HyperlinkButton | Clickable hyperlink |
| RepeatButton | Button that fires repeatedly while held |
| ToggleButton | Two-state pressable button |
| SplitButton | Button with an attached drop-down |

#### Input & Pickers

| Control | Description |
|---------|-------------|
| NumericUpDown | Numeric spinner control |
| DatePicker | Calendar-based date selection |
| TimePicker | Time selection widget |
| Calendar | Inline calendar |
| AutoCompleteBox | Text input with suggestions |
| ColorPicker | Color selection panel |

#### Containers

| Control | Description |
|---------|-------------|
| Expander | Collapsible content section |
| TabControl | Tabbed pages |
| Menu | Application menu bar |
| TreeView | Hierarchical tree list |
| DataGrid | Tabular data grid |
| ScrollViewer | Scrollable content area |
| SplitView | Two-pane layout with a collapsible pane |
| Carousel | Sliding panel carousel |
| NavigationView | Navigation drawer/menu |
| HeaderedContentControl | Content with a header |
| ContentControl | Single-item content host |
| ItemsControl | Collection-based items host |

#### Layout Panels

| Control | Description |
|---------|-------------|
| StackPanel | Stacks children vertically or horizontally |
| WrapPanel | Wraps children to the next row/column |
| DockPanel | Docks children to edges |
| Grid | Row-and-column grid layout |
| UniformGrid | Equal-cell grid |
| Canvas | Absolute-position surface |
| Border | Draws a border around content |
| Viewbox | Scales its child to fit |
| Panel | Base panel |
| RelativePanel | Positions children relative to each other |
| ItemsRepeater | Virtualised list of repeated items |

#### Shapes

| Shape | Description |
|-------|-------------|
| Rectangle | Filled or stroked rectangle |
| Ellipse | Filled or stroked ellipse / circle |
| Line | Straight line between two points |
| Path | Arbitrary vector path |
| Separator | Horizontal rule / divider |
| Polygon | Closed polygon |
| Polyline | Open polyline |
| Arc | Arc segment |

### Control Nesting

Container controls can hold child controls in all three designers (XAML, Razor, HTML). When you drag a new control from the toolbox and drop it onto a container, the container highlights with a dashed outline to show it will become the parent. The generated markup reflects this as properly indented, parent–child content.

**Nesting via drag-and-drop from toolbox:** Simply drop a new element onto an existing container on the canvas. The container highlights automatically.

**Re-parenting existing controls (Alt+drag):** Drag an existing control over a container, then hold **Alt** when you release the mouse button to nest it into that container. If the control is already nested, hold **Alt** while releasing outside any container to un-nest it back to the canvas root.

Nested controls are rendered above their parent in z-order and their positions are relative to the parent container's origin.

#### XAML Container Types

`Grid`, `StackPanel`, `DockPanel`, `WrapPanel`, `Canvas`, `UniformGrid`, `Panel`, `RelativePanel`, `VirtualizingStackPanel`, `Border`, `Viewbox`, `Expander`, `TabControl`, `ScrollViewer`, and more.

```xml
<StackPanel Canvas.Left="40" Canvas.Top="60" Width="200" Height="150">
    <Button Content="Click Me" Width="120" Height="32"/>
    <TextBlock Text="Hello" Width="120" Height="24"/>
</StackPanel>
```

#### HTML / Blazor Container Types

`div`, `section`, `article`, `nav`, `aside`, `main`, `header`, `footer`, `form`, `fieldset`, `ul`, `ol`, `li`, `table`, `tr`, `td`, `th`, `details`, `dialog`, `figure`, `blockquote`, `pre`, `code`, `a`, `button`, `label`, `select`, `video`, `audio`, `picture`, `canvas`, `svg`, `template`, `slot`, and many more.

```html
<div style="position:absolute;left:20px;top:30px;width:300px;height:200px;">
    <p style="position:absolute;left:10px;top:10px;width:200px;height:30px;">Hello</p>
    <button style="position:absolute;left:10px;top:50px;width:100px;height:32px;">Click</button>
</div>
```

#### Blazor-Specific Container Components

`LayoutView`, `AuthorizeView`, `Router`, `RouteView`, `FocusOnNavigate`, `ErrorBoundary`, `CascadingValue`, `CascadingAuthenticationState`, `HeadOutlet`, `EditForm`, and more.

### Properties Panel — XAML

When a XAML control is selected, the following fields are available in the Properties panel:

| Property | XAML Attribute | Description |
|----------|---------------|-------------|
| Name | `x:Name` | Unique identifier for the control |
| Content | `Content` | Text or inner content (where applicable) |
| X | `Canvas.Left` | Horizontal position on the canvas |
| Y | `Canvas.Top` | Vertical position on the canvas |
| Width | `Width` | Control width in pixels |
| Height | `Height` | Control height in pixels |
| Foreground | `Foreground` | Text / foreground colour |
| Background | `Background` | Background fill colour |
| FontSize | `FontSize` | Text font size |

---

## Razor Designer

`.razor` files open in a designer that draws the component the way the running Blazor app does, and edits the file in place without rewriting it.

**Rendering**
- The page is drawn in an isolated frame with the project's own stylesheets: the `<link rel="stylesheet">` tags of `App.razor` (or `wwwroot/index.html`, `_Host.cshtml`, `_Layout.cshtml`), including `@Assets["…"]` links. CSS isolation works too: every `X.razor.css` is scoped to its component the way Blazor builds `{Project}.styles.css`, including `::deep`.
- Child components are drawn from their own `.razor` files, with the parameters you pass (`ChildContent` included). Pages are shown inside their layout (`@layout` or the router's `DefaultLayout`); this can be turned off. Built-in components map to HTML (`EditForm`, `Input*`, `NavLink`); components from other libraries show as labelled boxes.
- Razor code runs at design time as far as it can: literals, parameters and simple fields are evaluated. Every condition that needs the running app (`@if`, `?:`, `switch`) becomes a toggle on the **State** tab, shared across components, so you can see each state (for example `Modern` on and off). Loops repeat their body a set number of times, and other `@expressions` show as named placeholders.
- Viewport presets (1920×1080 down to phone size) or a custom size; zoom and pan.

**Content that only exists when the app runs**
- **Sample text:** select an `@expression` (in the Outline, or Ctrl+click it on the page) and type what it should show, e.g. `v3.0.2` for `@VersionText`, so text takes its real width. Samples, like the State toggles, are kept for your workspace and never written to the file.
- **Drawn XAML:** markup that C# code builds at run time can be drawn from the XAML it comes from. If the project references `.xaml` files (for example a WPF window its Blazor app renders), an expression such as `@RenderDock` can show a chosen element of that XAML (the window content, or a named element such as a tab's grid), drawn with the WPF designer's renderer and optionally scaled to fit like a Viewbox. For expressions named `Render…` the designer offers this in one click. Double-click the drawn XAML to open that element in the WPF designer.
- **Live view:** the **Live** button shows the running app instead of the design view, with its real data and its code-built content. The extension puts a local proxy in front of the app that adds a small script to its pages; the app itself is not changed. Clicking an element on the live page selects the Razor element it comes from (matched by tag, classes and attributes; elements built by code select their nearest Razor ancestor), and the properties panel, CSS rules, Delete, Duplicate and Alt+↑/↓ work as usual. Edits go to the `.razor` file; with `dotnet watch` running (**Start app** opens it in a terminal) the page updates by itself through hot reload. **Use app** lets clicks through to the app, for example to open a dialog; **Select** switches back. The address defaults to the project's `launchSettings.json`. The command **Razor Designer: Toggle Live View** does the same from the Command Palette.

**Editing**
- Every change is a minimal text edit, applied through VS Code: code, comments and formatting you do not touch stay exactly as they are. Undo and redo use the normal editor history.
- Drag an element to reorder it: the middle of a target puts it inside, the edges before or after. Alt+↑/↓ also move it among its siblings. Absolutely positioned elements move by `left`/`top`; handles resize by writing `width`/`height` to the inline style.
- The properties panel edits text, classes (add or remove), inline style properties (the computed value is shown as a hint), attributes, event and binding directives, component parameters (the declared `[Parameter]`s are listed), and `@if`/`@foreach` conditions.
- **CSS rules**: the panel lists the rules that apply to the selected element, with file and line, from the project's stylesheets and the component's `.razor.css`. Editing a value, or adding a declaration, changes that CSS file (and saves it).
- The Outline tree shows elements, components, `@if`/`@foreach` blocks and expressions. Click selects an element of the file; Shift+click reaches inside child components; Ctrl+click steps through what is under the pointer (expressions included); Alt+click or Esc selects the parent. Double-click opens the source, or the child component's file.
- Toolbox: drag HTML elements onto the page. Ctrl+D duplicates the selection; Delete removes it.
- Selecting in the designer selects the tag in an open text editor, and moving the cursor in the text selects the element.

---

## HTML Designer

`.html` / `.htm` files open in a designer that draws the page with its own stylesheets and images, and edits the file in place without rewriting it. It has two modes; the page itself decides which one applies.

**Empty file:** a start screen creates either kind of page. For a fixed page you pick the resolution (Full HD, HD, 1366×768, a 1280×800 or 800×480 panel, 4K, portrait sizes, or any custom size) and the scale mode.

### Fixed page (HMI)

Works like the TwinCAT HMI editor: a page of a set resolution where everything stays exactly where you place it, and the whole page scales to the browser window.

- The page is a `<div class="hmi-page" data-scale="fit" style="width: 1280px; height: 800px;">`; its elements are placed with `position: absolute` and left/top/width/height. A small script in the page scales it in the browser. **Scale modes:** *Fit* (whole page, centred, like ScaleToFit), *Fit width* (scroll vertically), *Fit height* (scroll horizontally), *Stretch to fill*, and *No scaling*. The file stays plain HTML that works in any browser without the extension.
- **Resolution** and **scale mode** are in the toolbar and the page properties. **Window** previews the page in a window of another size, scaled the way the browser will scale it.
- **Placing:** drag controls from the toolbox (text, heading, button, image, rectangle, ellipse, line, group box, text box, checkbox, drop-down, link, table); they land where you drop them, on the grid.
- **Moving and resizing** snap to the page edges and centre, to the edges and centres of other elements (with pink guide lines), and to the grid (size adjustable; Alt moves freely). Shift keeps a move straight or a corner resize proportional; Ctrl+drag copies; arrow keys nudge by 1 px (Shift: 10).
- **Selecting:** click; Ctrl/Shift+click adds; drag on empty space for a marquee (Alt: only fully enclosed elements); Ctrl+A selects all.
- **Arranging:** align left/centre/right/top/middle/bottom (to the first selected), same width/height, distribute evenly, bring to front / send to back, group (Ctrl+G) and ungroup (Ctrl+Shift+G) keeping everything in place, lock (Ctrl+L). Double-click a group to work inside it; Esc goes back.
- **Position properties** like TwinCAT: left, top, right, bottom, width and height, each in px or % (switching converts the value). Right and bottom anchor an element to the far edge; left and right together stretch it. Also rotation, and a vertical text alignment.
- Double-click text (or F2) to edit it in place. Ctrl+C / Ctrl+V / Ctrl+X, Ctrl+D duplicates.

### Flow page

A normal web page: content flows with the window width. Nothing is ever converted to absolute positioning.

- Drag an element to reorder it: the middle of a target puts it inside, its edges before or after. Alt+↑/↓ move it among its siblings. Pressing inside the selected element drags it; a click without dragging selects the inner element. Alt+click selects the parent.
- Viewport presets (1920×1080 down to phone size) show how the page reflows.

### Both modes

- Every change is a minimal text edit, applied through VS Code: comments, scripts and formatting you do not touch stay exactly as they are. Undo and redo use the normal editor history.
- The properties panel edits text, classes, inline style properties (with the computed value as a hint), and attributes.
- **CSS rules:** the rules that apply to the selected element are listed, from linked stylesheets and from the page's `<style>` blocks. Editing a value or adding a declaration changes that stylesheet (saved) or the `<style>` block.
- Outline tree with search, outlines of every element, zoom and pan, cursor sync with the text editor, and **Preview** (saves and opens the page in the browser).

## Vue Designer

The Vue designer edits the `<template>` section of Vue Single File Components (`.vue` files). The `<script>` and `<style>` blocks are preserved as-is and are not modified by the designer.

### Vue Available Elements

The Vue designer provides the same full set of HTML elements available in the HTML designer, organized into the same categories:

#### Structure

`div`, `span`, `p`, `h1`–`h6`, `a`, `hr`, `br`, `blockquote`, `pre`, `code`

#### Forms

`input`, `textarea`, `select`, `button`, `label`, `form`, `fieldset`, `legend`, `output`, `meter`, `progress`, `datalist`

#### Media

`img`, `video`, `audio`, `canvas`, `svg`, `iframe`, `picture`, `source`, `figure`, `figcaption`

#### Lists & Tables

`ul`, `ol`, `li`, `dl`, `dt`, `dd`, `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `caption`, `colgroup`, `col`

#### Semantic / Layout

`nav`, `header`, `footer`, `section`, `article`, `aside`, `main`, `details`, `summary`, `dialog`, `template`, `slot`

### Properties Panel — Vue

| Property | Attribute | Description |
|----------|-----------|-------------|
| id | `id` | Element identifier |
| class | `class` | CSS class(es) |
| X | `style: left` | Horizontal position |
| Y | `style: top` | Vertical position |
| Width | `style: width` | Element width |
| Height | `style: height` | Element height |
| type | `type` | Input / button type |
| Custom attributes | Any | Any standard HTML attribute |

---

## React Designer

The React designer edits the JSX return block of React component files (`.jsx` / `.tsx`). The surrounding JavaScript/TypeScript code (imports, state, hooks, etc.) is preserved as-is and is not modified by the designer. The designer generates JSX-compliant output with `className` instead of `class`, `htmlFor` instead of `for`, and JSX-style inline styles.

### React Available Elements

The React designer provides the same full set of HTML elements available in the HTML designer, organized into the same categories:

#### Structure

`div`, `span`, `p`, `h1`–`h6`, `a`, `hr`, `br`, `blockquote`, `pre`, `code`

#### Forms

`input`, `textarea`, `select`, `button`, `label`, `form`, `fieldset`, `legend`, `output`, `meter`, `progress`, `datalist`

#### Media

`img`, `video`, `audio`, `canvas`, `svg`, `iframe`, `picture`, `source`, `figure`, `figcaption`

#### Lists & Tables

`ul`, `ol`, `li`, `dl`, `dt`, `dd`, `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `caption`, `colgroup`, `col`

#### Semantic / Layout

`nav`, `header`, `footer`, `section`, `article`, `aside`, `main`, `details`, `summary`, `dialog`, `template`, `slot`

### Properties Panel — React

| Property | Attribute | Description |
|----------|-----------|-------------|
| id | `id` | Element identifier |
| className | `className` | CSS class(es) (JSX equivalent of `class`) |
| X | `style: left` | Horizontal position |
| Y | `style: top` | Vertical position |
| Width | `style: width` | Element width |
| Height | `style: height` | Element height |
| type | `type` | Input / button type |
| Custom attributes | Any | Any standard JSX attribute |

---

## Live Preview

The **Live Preview** feature lets you preview markup files directly inside VS Code, in a side panel next to the editor. The preview updates automatically when the file is edited or saved.

### HTML Preview

HTML files (`.html`, `.htm`) are rendered directly in the preview panel.

| Method | Steps |
|--------|-------|
| **Explorer context menu** | Right-click an `.html` / `.htm` file in the Explorer → **Preview HTML in Side Panel** |
| **Command Palette** | Open an HTML file, then run `Preview HTML in Side Panel` from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) |

### XAML / AXAML Preview

XAML and AXAML files are converted to an approximate HTML representation for preview. Avalonia UI controls are mapped to their closest HTML equivalents — for example, `Button` becomes `<button>`, `TextBox` becomes `<input>`, `StackPanel` becomes a flex container, and so on. Layout attributes such as `Canvas.Left`, `Canvas.Top`, `Width`, `Height`, `Background`, and `Foreground` are translated to inline CSS.

| Method | Steps |
|--------|-------|
| **Explorer context menu** | Right-click a `.xaml` / `.axaml` file in the Explorer → **Preview XAML/AXAML in Side Panel** |
| **Command Palette** | Open a XAML/AXAML file, then run `Preview XAML/AXAML in Side Panel` from the Command Palette |

> **Note:** The XAML preview is an approximation. Complex control templates and bindings cannot be executed in a browser — the preview focuses on layout and visual structure.

### Razor Preview

Razor files (`.razor`) are transformed for preview by stripping C# directives (`@code`, `@using`, `@page`, etc.) and converting Blazor components to their HTML equivalents — for example, `EditForm` becomes `<form>`, `InputText` becomes `<input type="text">`, and so on.

| Method | Steps |
|--------|-------|
| **Explorer context menu** | Right-click a `.razor` file in the Explorer → **Preview Razor in Side Panel** |
| **Command Palette** | Open a Razor file, then run `Preview Razor in Side Panel` from the Command Palette |

> **Note:** The Razor preview shows the HTML structure only. C# code blocks, event handlers, and data bindings are removed for the preview.

### Preview Features

| Feature | Description |
|---------|-------------|
| **Side-by-side view** | The preview opens beside the current editor so you can edit and preview simultaneously |
| **Auto-refresh** | The preview refreshes automatically when the source file is edited or saved |
| **Refresh button** | Click the ↻ Refresh button in the preview toolbar to manually reload |
| **Sandboxed rendering** | The preview runs inside a sandboxed iframe for safety |
| **File-type badge** | A coloured badge in the toolbar indicates whether the preview is showing HTML, XAML, or Razor content |

---

## Keyboard Shortcuts

These shortcuts are active whenever the design canvas has focus.

| Shortcut | Action |
|----------|--------|
| `Delete` / `Backspace` | Delete the selected control |
| `Ctrl+Z` | Undo the last change |
| `Ctrl+Y` | Redo the last undone change |
| `Ctrl+D` | Duplicate the selected control |
| `Escape` | Deselect the current control |
| `↑` `↓` `←` `→` | Move the selected control by **1 px** |
| `Shift+↑` `Shift+↓` `Shift+←` `Shift+→` | Move the selected control by **10 px** |
| `Ctrl+Scroll Up` | Zoom in |
| `Ctrl+Scroll Down` | Zoom out |

---

## Toolbar Reference

The toolbar appears at the top of every designer.

| Button / Indicator | Shortcut | Action |
|--------------------|----------|--------|
| ↶ **Undo** | Ctrl+Z | Undo the last action |
| ↷ **Redo** | Ctrl+Y | Redo the last undone action |
| 🗑 **Delete** | Delete | Delete the selected control |
| ⬆ **Bring to Front** | — | Move the selected control to the top of the z-order |
| ⬇ **Send to Back** | — | Move the selected control to the bottom of the z-order |
| **● Auto-Sync badge** | — | Pulses green whenever the designer writes the current layout back to the source file (triggered automatically after a 300 ms idle period) |
| **xx% zoom badge** | — | Displays the current zoom level; click to reset to 100% |

---

## Context Menu Reference

Right-click any control on the canvas to open the context menu.

| Menu Item | Action |
|-----------|--------|
| **Delete** | Remove the control from the canvas |
| **Duplicate** | Create a copy of the control |
| **Bring to Front** | Move above all other controls |
| **Send to Back** | Move below all other controls |

---

## Development Guide

### Recommended VS Code Extensions

- **ESLint** — JavaScript/TypeScript linting
- **Prettier** — Code formatting

### Available npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `compile` | `npm run compile` | Run `tsc -p ./` — compiles TypeScript to `out/` |
| `watch` | `npm run watch` | Run `tsc -watch -p ./` — recompile on every save |
| `package` | `npm run package` | Package the extension as a `.vsix` file |

### Launch in Extension Development Host

1. Open the repository folder in VS Code.
2. Press **F5** (or run **Run → Start Debugging**).
3. A new VS Code window labelled *[Extension Development Host]* opens with the extension active.
4. Open any `.xaml`, `.axaml`, `.razor`, `.html`, or `.htm` file in that window and use **Open With…** to launch the designer.

### Making Changes

1. Edit source files in `src/`.
2. Run `npm run compile` (or keep `npm run watch` running).
3. Reload the Extension Development Host window with **Ctrl+R** / **Cmd+R** to pick up the new build.

### Packaging a Release Build

```bash
npm install
npm run compile
npm run package
```

The output file is `xaml-axaml-designer-<version>.vsix` in the project root.

---

## Project Structure

```
vs-code-wysiwyg/
├── src/
│   ├── extension.ts              # Extension entry point — registers all custom editors and commands
│   ├── xamlDesignerProvider.ts   # CustomTextEditorProvider for .xaml / .axaml
│   ├── razorDesignerProvider.ts  # CustomTextEditorProvider for .razor
│   ├── htmlDesignerProvider.ts   # CustomTextEditorProvider for .html / .htm (linked stylesheets, preview in the browser)
│   ├── htmlDesignerHtml.ts       # Webview page for the HTML designer
│   ├── vueDesignerProvider.ts    # CustomTextEditorProvider for .vue
│   ├── reactDesignerProvider.ts  # CustomTextEditorProvider for .jsx / .tsx
│   ├── htmlPreviewProvider.ts    # HTML live preview panel provider
│   ├── previewProvider.ts        # Unified preview provider for XAML/AXAML, Razor, and HTML files
│   ├── xamlDocument.ts           # XAML document model / parser helpers
│   ├── webviewContent.ts         # Webview HTML + embedded JS for the XAML designer
│   ├── vueWebviewContent.ts      # Webview HTML + embedded JS for the Vue designer
│   ├── reactWebviewContent.ts    # Webview HTML + embedded JS for the React designer
│   ├── razorDesignerHtml.ts      # Webview page for the Razor designer
│   ├── razorProject.ts           # Finds a Blazor project's components, .razor.css files, stylesheets, layout, linked XAML and launch URL
│   ├── liveProxy.ts              # Local proxy for the Razor designer's live view (HTTP and WebSocket, adds the agent script)
│   ├── designerEvents.ts         # Designer webview messages, for the integration tests
│   ├── wpfDesignerHtml.ts        # Webview page for the WPF designer
│   └── wpfImages.ts              # Image path resolution and DPI-aware sizes for the WPF designer
├── media/html/
│   ├── htmlDesigner.js           # HTML designer UI: fixed-page (HMI) and flow modes, snapping, alignment, grouping, properties
│   └── htmlDesigner.css          # HTML designer additions to the shared chrome
├── media/razor/
│   ├── razorCore.js              # Razor parser with source offsets, design-time C# evaluation, renderer, CSS isolation and rule parsing, text edits
│   ├── razorDesigner.js          # Razor designer UI: preview frame, selection, reorder/resize, properties and CSS rules, state, toolbox, drawn XAML, live view
│   ├── liveAgent.js              # Script the live-view proxy adds to the app's pages: reports elements to the designer
│   └── razorDesigner.css         # Razor designer additions to the shared chrome
├── media/wpf/
│   ├── wpfCore.js                # XAML parser with source offsets, WPF styles/triggers/bindings, WPF→HTML renderer, text edits
│   ├── wpfDesigner.js            # WPF designer UI: selection, move/resize, properties, outline, toolbox
│   ├── wpfRender.css             # WPF (Aero2) look in CSS
│   ├── wpfDesigner.css           # Designer chrome, follows the VS Code theme
│   └── fonts/                    # Selawik and Carlito (SIL OFL) as Segoe UI / Calibri stand-ins
├── test/
│   ├── integration/index.js      # Integration tests in a real VS Code (designers render, edits, CSS rule edits, live view)
│   ├── fixtures/site/            # Test pages for the HTML designer (a flow page with a linked stylesheet, a fixed page)
│   └── run-integration.sh        # Runs them headless on a copy of distribution_system: LIVE_URL=http://localhost:5091 test/run-integration.sh
├── out/                          # Compiled JavaScript output (generated by tsc)
├── package.json                  # Extension manifest, scripts, and dependencies
├── tsconfig.json                 # TypeScript compiler configuration
├── LICENSE                       # MIT License
└── .vscodeignore                 # Files excluded from the VSIX package
```
