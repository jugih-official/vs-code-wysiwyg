# XAML/AXAML Visual Designer

A VS Code extension that provides a WYSIWYG visual designer for `.xaml` and `.axaml` files.

## Features

- **Visual canvas** — drag controls from the toolbox onto a design surface
- **Resize handles** — click and drag corners/edges to resize controls
- **Properties panel** — edit position, size, name, and content
- **12 control types**: Button, TextBlock, TextBox, CheckBox, ComboBox, ListBox, Slider, ProgressBar, Image, StackPanel, Grid, Border
- **Undo/Redo** with Ctrl+Z / Ctrl+Y
- **Keyboard shortcuts**: Delete, Ctrl+D (duplicate), Arrow keys (move), Escape (deselect)
- **Sync to XAML** — generates Avalonia-compatible XAML from the visual layout
- **Context menu** with delete, duplicate, bring to front, send to back

## Usage

1. Open any `.xaml` or `.axaml` file
2. Click "Open With..." in the editor title bar and choose "XAML Visual Designer"
3. Drag controls from the left toolbox onto the canvas
4. Click controls to select, drag to move, use handles to resize
5. Edit properties in the right panel
6. Click "Sync to XAML" to write changes back to the file
