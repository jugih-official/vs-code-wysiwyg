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


# XAML / AXAML / Razor / HTML Visual Designer

A VS Code extension that provides a full **WYSIWYG visual designer** for `.xaml`, `.axaml`, `.razor`, `.html`, and `.htm` files.  
Design UIs by dragging controls onto a canvas — no hand-editing markup required. Changes sync back to the source file with a single click. <br>
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
   - [Syncing Changes to Source](#syncing-changes-to-source)
7. [XAML / AXAML Designer](#xaml--axaml-designer)
   - [Available Controls](#xaml-available-controls)
   - [Properties Panel — XAML](#properties-panel--xaml)
8. [Razor Designer](#razor-designer)
   - [Available Elements](#razor-available-elements)
   - [Properties Panel — Razor](#properties-panel--razor)
9. [HTML Designer](#html-designer)
   - [Available Elements](#html-available-elements)
   - [Properties Panel — HTML](#properties-panel--html)
10. [Live Preview](#live-preview)
    - [HTML Preview](#html-preview)
    - [XAML / AXAML Preview](#xaml--axaml-preview)
    - [Razor Preview](#razor-preview)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [Toolbar Reference](#toolbar-reference)
13. [Context Menu Reference](#context-menu-reference)
14. [Development Guide](#development-guide)
15. [Project Structure](#project-structure)

---

## Overview

**XAML/AXAML/Razor/HTML Visual Designer** is a VS Code custom editor extension that replaces the raw text view of markup files with an interactive design canvas. It is aimed at developers working with:

| File Type | Framework / Use-case |
|-----------|---------------------|
| `.xaml` / `.axaml` | Avalonia UI (WPF-like cross-platform UI framework) |
| `.razor` | Blazor (ASP.NET Core component model) |
| `.html` / `.htm` | Plain HTML / static web pages |

The extension is read-write: it parses the existing markup into a visual representation and can write the resulting layout back to disk as valid, formatted markup.

---

## Features at a Glance

| Feature | Details |
|---------|---------|
| **Drag-and-drop toolbox** | 50+ XAML controls, 18 Blazor components, 60+ HTML elements |
| **Visual canvas** | Absolute-positioned drag surface with pixel-accurate placement |
| **Resize handles** | 8-point handles (4 corners + 4 edges) on every selected control. Panes in the editor can now be resized by dragging their borders. |
| **Properties panel** | Dynamic panel showing all editable attributes for the selected control |
| **Undo / Redo** | Full per-session undo stack (Ctrl+Z / Ctrl+Y) |
| **Keyboard control** | Delete, Duplicate, Arrow-key nudging (1 px / 10 px), Escape |
| **Z-order management** | Bring to Front / Send to Back per control |
| **Context menu** | Right-click any control for common operations |
| **Sync to source** | One-click write-back of the visual layout as formatted markup |
| **Bi-directional sync** | External file edits update the canvas automatically |
| **Three designer modes** | Separate, purpose-built designers for XAML, Razor, and HTML |
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

#### 2. File Explorer Context Menu

Right-click any supported file in the **Explorer** file tree to see the relevant designer command directly in the context menu:

- `.xaml` / `.axaml` → **Open with XAML Visual Designer** and **Preview XAML/AXAML in Side Panel**
- `.razor` → **Open with Razor Visual Designer** and **Preview Razor in Side Panel**
- `.html` / `.htm` → **Open with HTML Visual Designer** and **Preview HTML in Side Panel**

This allows you to open the designer without opening the file first.

#### 3. Command Palette

You can also run the corresponding command from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Action |
|---------|--------|
| `Open with XAML Visual Designer` | Opens the active `.xaml`/`.axaml` file in the XAML designer |
| `Open with Razor Visual Designer` | Opens the active `.razor` file in the Razor designer |
| `Open with HTML Visual Designer` | Opens the active `.html`/`.htm` file in the HTML designer |
| `Preview HTML in Side Panel` | Opens a live HTML preview beside the editor |
| `Preview XAML/AXAML in Side Panel` | Opens an approximate HTML preview of a XAML/AXAML file beside the editor |
| `Preview Razor in Side Panel` | Opens an approximate HTML preview of a Razor file beside the editor |

### Designer Layout

Every designer shares the same three-pane layout. Panes can now be resized by dragging their borders:

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar  [↶ Undo] [↷ Redo] [🗑 Delete] [⬆ Front]      │
│           [⬇ Back] [💾 Sync to <Format>]                │
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

### Syncing Changes to Source

Click the **"Sync to &lt;Format&gt;"** button in the toolbar (or use the toolbar's 💾 button) to write the current visual layout back to the source file as formatted markup.

The extension also listens for external file changes: if the `.xaml`, `.razor`, or `.html` file is edited in another editor tab, the canvas will refresh automatically.

---

## XAML / AXAML Designer

The XAML designer generates **Avalonia UI**-compatible XAML markup.  
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

The Razor designer generates Blazor-compatible Razor markup (`.razor`).  
It supports both standard HTML elements and Blazor-specific components in a single canvas.

### Razor Available Elements

#### HTML Structure

`div`, `span`, `p`, `h1`–`h6`, `a`, `hr`, `br`, `blockquote`, `pre`, `code`

#### HTML Forms

`input`, `textarea`, `select`, `button`, `label`, `form`, `fieldset`

#### HTML Lists & Tables

`ul`, `ol`, `li`, `table`, `tr`, `th`, `td`

#### HTML Semantic / Layout

`nav`, `header`, `footer`, `section`, `article`, `aside`, `main`

#### Blazor Components

| Component | Description |
|-----------|-------------|
| `EditForm` | Form bound to a model with validation |
| `InputText` | `<input type="text">` bound with `@bind` |
| `InputNumber` | `<input type="number">` |
| `InputDate` | `<input type="date">` |
| `InputSelect` | `<select>` bound to a model property |
| `InputCheckbox` | `<input type="checkbox">` |
| `InputTextArea` | `<textarea>` |
| `InputFile` | File-upload input |
| `InputRadio` | Single radio button |
| `InputRadioGroup` | Group of radio buttons |
| `ValidationSummary` | Shows all validation messages |
| `ValidationMessage` | Shows validation message for a single field |
| `AuthorizeView` | Shows content based on authorisation state |
| `CascadingValue` | Provides a cascading parameter down the tree |
| `Virtualize` | Efficient rendering of large lists |
| `PageTitle` | Sets the HTML page `<title>` |
| `HeadContent` | Injects content into `<head>` |
| `ErrorBoundary` | Catches render errors in child content |

### Properties Panel — Razor

| Property | Attribute | Description |
|----------|-----------|-------------|
| id | `id` | Element identifier |
| class | `class` | CSS class(es) |
| X | `style: left` | Horizontal position |
| Y | `style: top` | Vertical position |
| Width | `style: width` | Element width |
| Height | `style: height` | Element height |
| @onclick | `@onclick` | Blazor click event handler |
| disabled | `disabled` | Disabled state |
| Custom attributes | Any | Blazor binding directives (`@bind`, etc.) |

---

## HTML Designer

The HTML designer generates standard HTML5 markup (`.html` / `.htm`).

### HTML Available Elements

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

### Properties Panel — HTML

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

---

## Toolbar Reference

The toolbar appears at the top of every designer.

| Button | Shortcut | Action |
|--------|----------|--------|
| ↶ **Undo** | Ctrl+Z | Undo the last action |
| ↷ **Redo** | Ctrl+Y | Redo the last undone action |
| 🗑 **Delete** | Delete | Delete the selected control |
| ⬆ **Bring to Front** | — | Move the selected control to the top of the z-order |
| ⬇ **Send to Back** | — | Move the selected control to the bottom of the z-order |
| 💾 **Sync to &lt;Format&gt;** | — | Write the visual layout back to the source file |

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
│   ├── htmlDesignerProvider.ts   # CustomTextEditorProvider for .html / .htm
│   ├── htmlPreviewProvider.ts    # HTML live preview panel provider
│   ├── previewProvider.ts        # Unified preview provider for XAML/AXAML, Razor, and HTML files
│   ├── xamlDocument.ts           # XAML document model / parser helpers
│   ├── webviewContent.ts         # Webview HTML + embedded JS for the XAML designer
│   ├── razorWebviewContent.ts    # Webview HTML + embedded JS for the Razor designer
│   └── htmlWebviewContent.ts     # Webview HTML + embedded JS for the HTML designer
├── out/                          # Compiled JavaScript output (generated by tsc)
├── package.json                  # Extension manifest, scripts, and dependencies
├── tsconfig.json                 # TypeScript compiler configuration
├── LICENSE                       # MIT License
└── .vscodeignore                 # Files excluded from the VSIX package
```
