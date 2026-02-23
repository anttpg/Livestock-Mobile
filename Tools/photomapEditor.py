import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
from PIL import Image, ImageTk, ImageDraw
import json
import os
import math

class MapSegmentationTool:
    def __init__(self, root):
        self.root = root
        self.root.title("Map Segmentation Tool")
        self.root.geometry("1200x800")
        
        # Variables
        self.source_file = None
        self.output_location = None
        self.map_image = None
        self.original_image = None
        self.display_image = None
        self.map_width = 0
        self.map_height = 0
        self.scale_factor = 1.0
        
        # Zoom and pan variables
        self.zoom_level = 1.0
        self.pan_x = 0
        self.pan_y = 0
        self.last_pan_x = 0
        self.last_pan_y = 0
        self.is_panning = False
        self.image_scale = 1.0  # Actual scale used for image resizing (for performance)
        
        # Field data
        self.fields = []
        self.current_field = None
        self.current_points = []
        self.unnamed_field_count = 0
        self.selected_field_index = None
        self.moving_pin_mode = False
        
        # Colors for fields
        self.colors = [
            "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
            "#FFA500", "#800080", "#FFC0CB", "#A52A2A", "#808080", "#000080"
        ]
        self.color_index = 0
        
        self.setup_ui()
        
    def setup_ui(self):
        # Main frame
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Top frame for file selection
        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(top_frame, text="Select Source File", command=self.select_source_file).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(top_frame, text="Select Output Location", command=self.select_output_location).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(top_frame, text="Load Existing Data", command=self.load_existing_data).pack(side=tk.LEFT, padx=(0, 10))
        
        self.source_label = ttk.Label(top_frame, text="No source file selected")
        self.source_label.pack(side=tk.LEFT, padx=(20, 0))
        
        # Middle frame
        middle_frame = ttk.Frame(main_frame)
        middle_frame.pack(fill=tk.BOTH, expand=True)
        
        # Left panel for legend and controls
        left_panel = ttk.Frame(middle_frame, width=250)
        left_panel.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        left_panel.pack_propagate(False)
        
        # Field controls
        controls_frame = ttk.LabelFrame(left_panel, text="Field Controls")
        controls_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.create_field_btn = ttk.Button(controls_frame, text="Create New Field", command=self.create_new_field)
        self.create_field_btn.pack(fill=tk.X, pady=5)
        
        self.finish_field_btn = ttk.Button(controls_frame, text="Finish Field", command=self.finish_field, state=tk.DISABLED)
        self.finish_field_btn.pack(fill=tk.X, pady=5)
        
        self.undo_btn = ttk.Button(controls_frame, text="Undo Last Point", command=self.undo_last_point, state=tk.DISABLED)
        self.undo_btn.pack(fill=tk.X, pady=5)
        
        # Field selection and pin moving
        selection_frame = ttk.LabelFrame(left_panel, text="Field Selection")
        selection_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(selection_frame, text="Selected Field:").pack(anchor=tk.W, padx=5, pady=2)
        self.field_var = tk.StringVar()
        self.field_dropdown = ttk.Combobox(selection_frame, textvariable=self.field_var, state="readonly")
        self.field_dropdown.pack(fill=tk.X, padx=5, pady=2)
        self.field_dropdown.bind("<<ComboboxSelected>>", self.on_field_selected)
        
        self.move_pin_btn = ttk.Button(selection_frame, text="Move Pin", command=self.start_move_pin, state=tk.DISABLED)
        self.move_pin_btn.pack(fill=tk.X, padx=5, pady=5)
        
        # Legend
        legend_frame = ttk.LabelFrame(left_panel, text="Fields Legend")
        legend_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        # Create scrollable legend
        legend_canvas = tk.Canvas(legend_frame, bg='white')
        legend_scrollbar = ttk.Scrollbar(legend_frame, orient="vertical", command=legend_canvas.yview)
        self.legend_frame_inner = ttk.Frame(legend_canvas)
        
        self.legend_frame_inner.bind(
            "<Configure>",
            lambda e: legend_canvas.configure(scrollregion=legend_canvas.bbox("all"))
        )
        
        legend_canvas.create_window((0, 0), window=self.legend_frame_inner, anchor="nw")
        legend_canvas.configure(yscrollcommand=legend_scrollbar.set)
        
        legend_canvas.pack(side="left", fill="both", expand=True)
        legend_scrollbar.pack(side="right", fill="y")
        
        # Map display area
        map_frame = ttk.Frame(middle_frame)
        map_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.canvas = tk.Canvas(map_frame, bg='white', cursor='crosshair')
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.bind("<Button-1>", self.on_canvas_click)
        self.canvas.bind("<MouseWheel>", self.on_mousewheel)  # Windows
        self.canvas.bind("<Button-4>", self.on_mousewheel)    # Linux
        self.canvas.bind("<Button-5>", self.on_mousewheel)    # Linux
        self.canvas.bind("<ButtonPress-2>", self.start_pan)   # Middle mouse press
        self.canvas.bind("<B2-Motion>", self.on_pan)          # Middle mouse drag
        self.canvas.bind("<ButtonRelease-2>", self.stop_pan)  # Middle mouse release
        self.canvas.focus_set()  # Allow canvas to receive focus for key events
        
        # Bottom frame for opacity slider and save button
        bottom_frame = ttk.Frame(main_frame)
        bottom_frame.pack(fill=tk.X, pady=(10, 0))
        
        # Opacity slider
        opacity_frame = ttk.Frame(bottom_frame)
        opacity_frame.pack(side=tk.LEFT)
        
        ttk.Label(opacity_frame, text="Fill Opacity:").pack(side=tk.LEFT)
        self.opacity_var = tk.DoubleVar(value=30)
        self.opacity_slider = ttk.Scale(opacity_frame, from_=0, to=100, orient=tk.HORIZONTAL, 
                                       variable=self.opacity_var, command=self.update_opacity)
        self.opacity_slider.pack(side=tk.LEFT, padx=(5, 0))
        
        self.opacity_label = ttk.Label(opacity_frame, text="30%")
        self.opacity_label.pack(side=tk.LEFT, padx=(5, 0))
        
        # Text size slider
        text_size_frame = ttk.Frame(bottom_frame)
        text_size_frame.pack(side=tk.LEFT, padx=(20, 0))
        
        ttk.Label(text_size_frame, text="Text Size:").pack(side=tk.LEFT)
        self.text_size_var = tk.DoubleVar(value=12)
        self.text_size_slider = ttk.Scale(text_size_frame, from_=8, to=24, orient=tk.HORIZONTAL, 
                                         variable=self.text_size_var, command=self.update_text_size)
        self.text_size_slider.pack(side=tk.LEFT, padx=(5, 0))
        
        self.text_size_label = ttk.Label(text_size_frame, text="12pt")
        self.text_size_label.pack(side=tk.LEFT, padx=(5, 0))
        
        # Save button
        ttk.Button(bottom_frame, text="Save & Exit", command=self.save_and_exit).pack(side=tk.RIGHT)
        
    def select_source_file(self):
        file_path = filedialog.askopenfilename(
            title="Select Map Image",
            filetypes=[("Image files", "*.png *.jpg *.jpeg *.gif *.bmp *.tiff")]
        )
        if file_path:
            self.source_file = file_path
            self.source_label.config(text=f"Source: {os.path.basename(file_path)}")
            self.load_map_image()
            
    def load_existing_data(self):
        file_path = filedialog.askopenfilename(
            title="Load Map Data",
            filetypes=[("JSON files", "*.json")]
        )
        if file_path:
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                
                # Load fields from data
                if 'fields' in data:
                    self.fields = []
                    self.color_index = 0
                    
                    for field_data in data['fields']:
                        field = {
                            'name': field_data.get('fieldname', 'Unnamed Field'),
                            'color': field_data.get('color', self.colors[self.color_index % len(self.colors)]),
                            'pin_location': field_data.get('pinpoint'),
                            'points': field_data.get('points', [])
                        }
                        self.fields.append(field)
                        self.color_index += 1
                
                # Update map size if available
                if 'map_size' in data:
                    map_size = data['map_size']
                    if self.map_width == 0:  # Only update if no map loaded yet
                        self.map_width = map_size.get('width', self.map_width)
                        self.map_height = map_size.get('height', self.map_height)
                
                self.update_field_dropdown()
                self.update_legend()
                if self.original_image:
                    self.redraw_fields()
                    
                        
                messagebox.showinfo("Success", f"Loaded {len(self.fields)} fields from {os.path.basename(file_path)}")
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load data: {str(e)}")
        
    def update_text_size(self, value=None):
        """Update text size and redraw fields"""
        self.text_size_label.config(text=f"{int(self.text_size_var.get())}pt")
        self.redraw_fields()

            
    def select_output_location(self):
        folder_path = filedialog.askdirectory(title="Select Output Folder")
        if folder_path:
            self.output_location = folder_path
            
    def load_map_image(self):
        try:
            self.original_image = Image.open(self.source_file)
            self.map_width, self.map_height = self.original_image.size
            
            # Reset zoom and pan when loading new image
            self.zoom_level = 1.0
            self.pan_x = 0
            self.pan_y = 0
            
            # Calculate initial scale to fit canvas
            canvas_width = 800  # Approximate canvas width
            canvas_height = 600  # Approximate canvas height
            
            scale_x = canvas_width / self.map_width
            scale_y = canvas_height / self.map_height
            self.scale_factor = min(scale_x, scale_y, 1.0)  # Don't scale up initially
            
            self.update_display_image()
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load image: {str(e)}")
            
    def update_display_image(self):
        if not self.original_image:
            return
            
        # For performance: only resize image moderately, let canvas handle the rest
        # Use a reasonable maximum display size to prevent lag
        max_display_size = 2048
        
        base_scale = min(max_display_size / self.map_width, max_display_size / self.map_height, 1.0)
        display_scale = base_scale * min(self.zoom_level, 2.0)  # Limit image resize for performance
        
        display_width = int(self.map_width * display_scale)
        display_height = int(self.map_height * display_scale)
        
        # Store the actual scale used for image resizing
        self.image_scale = display_scale
        
        # Resize image for display
        self.map_image = self.original_image.resize((display_width, display_height), Image.Resampling.LANCZOS)
        self.display_image = self.map_image.copy()
        
        self.redraw_fields()
        self.update_canvas()
            
    def update_canvas(self):
        if self.display_image:
            self.photo = ImageTk.PhotoImage(self.display_image)
            self.canvas.delete("all")
            
            # Apply pan offset
            image_x = self.pan_x
            image_y = self.pan_y
            
            self.canvas.create_image(image_x, image_y, anchor=tk.NW, image=self.photo)
            
            # Update scroll region to allow panning beyond visible area
            bbox = self.canvas.bbox("all")
            if bbox:
                self.canvas.configure(scrollregion=bbox)
            
    def create_new_field(self):
        if not self.map_image:
            messagebox.showwarning("Warning", "Please select a map image first.")
            return
            
        # Get field name
        field_name = simpledialog.askstring("Field Name", "Enter field name:")
        if not field_name:
            self.unnamed_field_count += 1
            field_name = f"Unnamed Field {self.unnamed_field_count}"
            
        # Get color for this field
        color = self.colors[self.color_index % len(self.colors)]
        
        self.current_field = {
            'name': field_name,
            'color': color,
            'points': [],
            'pin_location': None
        }
        
        self.current_points = []
        self.color_index += 1
        
        # Enable finish button and undo button
        self.finish_field_btn.config(state=tk.NORMAL)
        self.create_field_btn.config(state=tk.DISABLED)
        self.undo_btn.config(state=tk.DISABLED)  # No points to undo yet
        
        messagebox.showinfo("Info", f"Click on the map to add points for '{field_name}'. Click 'Finish Field' when done.")
        
    def on_canvas_click(self, event):
        if self.is_panning:
            return
            
        # Get the actual canvas widget position and size
        canvas_widget = event.widget
        canvas_x = canvas_widget.canvasx(event.x)
        canvas_y = canvas_widget.canvasy(event.y)
        
        # Convert canvas coordinates to image coordinates
        # Account for pan offset
        image_canvas_x = canvas_x - self.pan_x
        image_canvas_y = canvas_y - self.pan_y
        
        # Convert from display coordinates to original image coordinates
        x = image_canvas_x / self.image_scale
        y = image_canvas_y / self.image_scale
        
        # Ensure coordinates are within image bounds
        x = max(0, min(x, self.map_width))
        y = max(0, min(y, self.map_height))
        
        # Handle pin moving mode
        if self.moving_pin_mode and self.selected_field_index is not None:
            self.fields[self.selected_field_index]['pin_location'] = [x, y]
            self.moving_pin_mode = False
            self.move_pin_btn.config(text="Move Pin")
            self.canvas.config(cursor="crosshair")
            messagebox.showinfo("Pin Moved", f"Pin moved for field '{self.fields[self.selected_field_index]['name']}'")
            self.redraw_fields()
            return
        
        # Handle normal field creation
        if not self.current_field:
            return
            
        if self.current_field['pin_location'] is None:
            # This is the pin location
            self.current_field['pin_location'] = [x, y]
            messagebox.showinfo("Pin Placed", "Pin location set. Continue clicking to add boundary points.")
        else:
            # Add boundary point
            self.current_points.append([x, y])
            self.current_field['points'] = self.current_points.copy()
            # Enable undo button since we now have boundary points
            self.undo_btn.config(state=tk.NORMAL)
            
        self.redraw_fields()
        
    def finish_field(self):
        if not self.current_field or len(self.current_points) < 3:
            messagebox.showwarning("Warning", "Please add at least 3 points to create a field.")
            return
            
        if self.current_field['pin_location'] is None:
            messagebox.showwarning("Warning", "Please place the pin location first.")
            return
            
        # Add completed field to list
        self.fields.append(self.current_field.copy())
        
        # Print field data in JSON format
        field_data = {
            'fieldname': self.current_field['name'],
            'pinpoint': self.current_field['pin_location'],
            'points': self.current_field['points']
        }
        print(json.dumps(field_data, indent=2))
        
        # Reset current field
        self.current_field = None
        self.current_points = []
        
        # Update UI
        self.finish_field_btn.config(state=tk.DISABLED)
        self.create_field_btn.config(state=tk.NORMAL)
        self.undo_btn.config(state=tk.DISABLED)
        
        self.update_legend()
        self.update_field_dropdown()
        self.redraw_fields()
        
    def redraw_fields(self):
        if not self.map_image:
            return
            
        # Start with original map at current zoom level
        self.display_image = self.map_image.copy()
        draw = ImageDraw.Draw(self.display_image, 'RGBA')
        
        # Draw completed fields (polygons and lines first)
        for field in self.fields:
            self.draw_field_background(draw, field, completed=True)
            
        # Draw current field being created (background)
        if self.current_field:
            self.draw_field_background(draw, self.current_field, completed=False)
            
        # Draw all text and pins on top
        for field in self.fields:
            self.draw_field_text(draw, field)
            
        # Draw current field text
        if self.current_field:
            self.draw_field_text(draw, self.current_field)
            
        self.update_canvas()
        
    def draw_field_background(self, draw, field, completed=False):
        """Draw the background elements (lines, polygons, points)"""
        color = field['color']
        
        # Convert coordinates to display coordinates using the actual image scale
        def to_display_coords(point):
            return (point[0] * self.image_scale, point[1] * self.image_scale)
            
        # Draw points and lines
        if field['points']:
            display_points = [to_display_coords(p) for p in field['points']]
            
            # Draw points with constant size (half of pin size)
            point_size = 4  # Constant size, half of pin size
            for point in display_points:
                draw.ellipse([point[0]-point_size, point[1]-point_size, 
                            point[0]+point_size, point[1]+point_size], 
                           fill=color, outline='black')
                           
            # Draw lines between points with constant width
            line_width = 2  # Constant line width
            if len(display_points) > 1:
                for i in range(len(display_points) - 1):
                    draw.line([display_points[i], display_points[i+1]], fill=color, width=line_width)
                    
            # If completed, close the shape and fill
            if completed and len(display_points) > 2:
                # Close the shape
                draw.line([display_points[-1], display_points[0]], fill=color, width=line_width)
                
                # Fill the polygon
                opacity = int(255 * (self.opacity_var.get() / 100))
                fill_color = tuple(list(self.hex_to_rgb(color)) + [opacity])
                draw.polygon(display_points, fill=fill_color)
                
    def draw_field_text(self, draw, field):
        """Draw the text and pin elements on top"""
        color = field['color']
        
        # Convert coordinates to display coordinates using the actual image scale
        def to_display_coords(point):
            return (point[0] * self.image_scale, point[1] * self.image_scale)
            
        # Draw pin with constant size (as if fully zoomed out)
        if field['pin_location']:
            pin_x, pin_y = to_display_coords(field['pin_location'])
            pin_size = 8  # Constant size regardless of zoom
            draw.ellipse([pin_x-pin_size, pin_y-pin_size, pin_x+pin_size, pin_y+pin_size], 
                        fill=color, outline='black', width=2)
            
            # Draw field name with customizable font size and white color
            try:
                from PIL import ImageFont
                font_size = int(self.text_size_var.get())
                font = ImageFont.truetype("arial.ttf", font_size)
            except:
                font = None
                
            # Draw text with black outline for better visibility
            text_x = pin_x + pin_size + 2
            text_y = pin_y - pin_size
            
            # Draw black outline (multiple offset draws)
            outline_offsets = [(-1, -1), (-1, 1), (1, -1), (1, 1), (-1, 0), (1, 0), (0, -1), (0, 1)]
            for offset_x, offset_y in outline_offsets:
                draw.text((text_x + offset_x, text_y + offset_y), field['name'], fill='black', font=font)
            
            # Draw white text on top
            draw.text((text_x, text_y), field['name'], fill='white', font=font)
                
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        
    def update_opacity(self, value=None):
        self.opacity_label.config(text=f"{int(self.opacity_var.get())}%")
        self.redraw_fields()
        
    def undo_last_point(self):
        """Remove the last placed boundary point (not the pin)"""
        if not self.current_field or not self.current_points:
            return
            
        # Remove the last boundary point
        self.current_points.pop()
        self.current_field['points'] = self.current_points.copy()
        
        # Disable undo button if no more boundary points
        if not self.current_points:
            self.undo_btn.config(state=tk.DISABLED)
            
        # Redraw the field
        self.redraw_fields()
        
    def update_field_dropdown(self):
        """Update the field selection dropdown"""
        field_names = [f"{i}: {field['name']}" for i, field in enumerate(self.fields)]
        self.field_dropdown['values'] = field_names
        
        # Enable move pin button if fields exist
        if self.fields:
            self.move_pin_btn.config(state=tk.NORMAL)
        else:
            self.move_pin_btn.config(state=tk.DISABLED)
            
    def on_field_selected(self, event=None):
        """Handle field selection from dropdown"""
        if self.field_var.get():
            # Extract index from selection (format is "index: name")
            self.selected_field_index = int(self.field_var.get().split(':')[0])
            
    def start_move_pin(self):
        """Start pin moving mode"""
        if self.selected_field_index is None:
            messagebox.showwarning("Warning", "Please select a field first.")
            return
            
        if self.current_field is not None:
            messagebox.showwarning("Warning", "Please finish creating the current field before moving pins.")
            return
            
        self.moving_pin_mode = True
        self.move_pin_btn.config(text="Cancel Move")
        self.canvas.config(cursor="target")
        
        field_name = self.fields[self.selected_field_index]['name']
        messagebox.showinfo("Move Pin", f"Click on the map to place the new pin location for '{field_name}'.")
        
    def calculate_field_radius(self, field):
        """Calculate radius for minimap view using raycast from pin"""
        if not field['pin_location'] or not field['points'] or len(field['points']) < 3:
            # Default radius if no valid field
            default_radius = max(self.map_width, self.map_height) / 20
            return default_radius
            
        pin_x, pin_y = field['pin_location']
        field_points = field['points']
        
        # Add the first point at the end to close the polygon
        polygon_points = field_points + [field_points[0]]
        
        max_distance = 0
        hit_count = 0
        
        # Cast 20 rays in different directions
        import math
        for i in range(20):
            angle = (i / 20) * 2 * math.pi
            dx = math.cos(angle)
            dy = math.sin(angle)
            
            # Find intersection with polygon edges
            min_distance = float('inf')
            
            for j in range(len(polygon_points) - 1):
                x1, y1 = polygon_points[j]
                x2, y2 = polygon_points[j + 1]
                
                # Line intersection calculation
                # Ray: pin + t * (dx, dy)
                # Edge: (x1, y1) to (x2, y2)
                
                edge_dx = x2 - x1
                edge_dy = y2 - y1
                
                # Solve: pin_x + t*dx = x1 + s*edge_dx
                #        pin_y + t*dy = y1 + s*edge_dy
                
                denominator = dx * edge_dy - dy * edge_dx
                if abs(denominator) < 1e-10:  # Parallel lines
                    continue
                    
                t = ((x1 - pin_x) * edge_dy - (y1 - pin_y) * edge_dx) / denominator
                s = ((x1 - pin_x) * dy - (y1 - pin_y) * dx) / denominator
                
                # Check if intersection is valid (on the edge and in ray direction)
                if t > 0 and 0 <= s <= 1:
                    distance = t * math.sqrt(dx*dx + dy*dy)
                    min_distance = min(min_distance, distance)
            
            if min_distance != float('inf'):
                max_distance = max(max_distance, min_distance)
                hit_count += 1
        
        # Check if we got valid hits and reasonable distance
        map_max_size = max(self.map_width, self.map_height)
        min_threshold = map_max_size / 100
        
        if hit_count == 0 or max_distance < min_threshold:
            # Use default radius
            radius = map_max_size / 20
        else:
            # Add 10% buffer to the maximum distance
            radius = max_distance * 1.1
            
        return radius
        
    def on_mousewheel(self, event):
        if not self.original_image:
            return
            
        # Get mouse position relative to canvas
        canvas_x = self.canvas.canvasx(event.x)
        canvas_y = self.canvas.canvasy(event.y)
        
        # Determine zoom direction
        if event.delta > 0 or event.num == 4:  # Zoom in
            zoom_factor = 1.1
        else:  # Zoom out
            zoom_factor = 0.9
            
        # Calculate new zoom level
        old_zoom = self.zoom_level
        new_zoom = self.zoom_level * zoom_factor
        
        # Limit zoom range
        new_zoom = max(0.1, min(new_zoom, 10.0))
        
        if new_zoom != old_zoom:
            # Calculate the point under the mouse in image coordinates
            image_x = (canvas_x - self.pan_x) / self.image_scale
            image_y = (canvas_y - self.pan_y) / self.image_scale
            
            # Update zoom level and recalculate image scale
            self.zoom_level = new_zoom
            self.update_display_image()
            
            # Adjust pan to keep the same point under mouse cursor
            new_image_x = image_x * self.image_scale
            new_image_y = image_y * self.image_scale
            
            self.pan_x = canvas_x - new_image_x
            self.pan_y = canvas_y - new_image_y
            
            # Update canvas without redrawing fields again
            self.update_canvas()
            
    def start_pan(self, event):
        self.is_panning = True
        self.last_pan_x = event.x
        self.last_pan_y = event.y
        self.canvas.config(cursor="hand2")
        
    def on_pan(self, event):
        if self.is_panning:
            # Calculate pan delta
            dx = event.x - self.last_pan_x
            dy = event.y - self.last_pan_y
            
            # Update pan position
            self.pan_x += dx
            self.pan_y += dy
            
            # Update last position
            self.last_pan_x = event.x
            self.last_pan_y = event.y
            
            # Update canvas
            self.update_canvas()
            
    def stop_pan(self, event):
        self.is_panning = False
        self.canvas.config(cursor="crosshair")
        
    def update_legend(self):
        # Clear existing legend
        for widget in self.legend_frame_inner.winfo_children():
            widget.destroy()
            
        # Add legend entries
        for i, field in enumerate(self.fields):
            frame = ttk.Frame(self.legend_frame_inner)
            frame.pack(fill=tk.X, pady=2)
            
            # Color box
            color_canvas = tk.Canvas(frame, width=20, height=20, bg=field['color'])
            color_canvas.pack(side=tk.LEFT, padx=(0, 5))
            
            # Field name
            ttk.Label(frame, text=field['name']).pack(side=tk.LEFT)
            
    def save_and_exit(self):
        if not self.output_location:
            messagebox.showwarning("Warning", "Please select an output location first.")
            return
            
        if not self.fields:
            messagebox.showwarning("Warning", "No fields to save.")
            return
            
        try:
            # Prepare data for JSON
            map_data = {
                'map_size': {'width': self.map_width, 'height': self.map_height},
                'fields': []
            }
            
            for field in self.fields:
                field_data = {
                    'fieldname': field['name'],
                    'color': field['color'],
                    'pinpoint': field['pin_location'],
                    'points': field['points'],
                    'radius': self.calculate_field_radius(field)
                }
                map_data['fields'].append(field_data)
                
            # Save JSON data
            json_path = os.path.join(self.output_location, 'Mapdata.json')
            with open(json_path, 'w') as f:
                json.dump(map_data, f, indent=2)
                
            # Save map image (without legend)
            if self.display_image:
                map_path = os.path.join(self.output_location, 'map.png')
                self.display_image.save(map_path)
                
            messagebox.showinfo("Success", f"Data saved to:\n{json_path}\n{map_path}")
            self.root.quit()
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save data: {str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = MapSegmentationTool(root)
    root.mainloop()