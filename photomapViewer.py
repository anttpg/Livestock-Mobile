import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk, ImageDraw
import json
import os
import math

class MinimapZoomViewer:
    def __init__(self, root):
        self.root = root
        self.root.title("Minimap Zoom Viewer")
        self.root.geometry("1000x700")
        
        # Variables
        self.map_data = None
        self.original_image = None
        self.minimap_images = []
        self.current_minimap_index = 0
        
        self.setup_ui()
        
    def setup_ui(self):
        # Main frame
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Top frame for file selection
        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(top_frame, text="Load Map Data", command=self.load_map_data).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(top_frame, text="Load Map Image", command=self.load_map_image).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(top_frame, text="Regenerate Centers", command=self.regenerate_centers).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(top_frame, text="Generate Minimaps", command=self.generate_minimaps).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(top_frame, text="Save All Minimaps", command=self.save_all_minimaps).pack(side=tk.LEFT, padx=(0, 10))
        
        # Middle frame
        middle_frame = ttk.Frame(main_frame)
        middle_frame.pack(fill=tk.BOTH, expand=True)
        
        # Left panel for field list
        left_panel = ttk.Frame(middle_frame, width=250)
        left_panel.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        left_panel.pack_propagate(False)
        
        # Field list
        fields_frame = ttk.LabelFrame(left_panel, text="Fields")
        fields_frame.pack(fill=tk.BOTH, expand=True)
        
        # Create scrollable field list
        fields_canvas = tk.Canvas(fields_frame, bg='white')
        fields_scrollbar = ttk.Scrollbar(fields_frame, orient="vertical", command=fields_canvas.yview)
        self.fields_frame_inner = ttk.Frame(fields_canvas)
        
        self.fields_frame_inner.bind(
            "<Configure>",
            lambda e: fields_canvas.configure(scrollregion=fields_canvas.bbox("all"))
        )
        
        fields_canvas.create_window((0, 0), window=self.fields_frame_inner, anchor="nw")
        fields_canvas.configure(yscrollcommand=fields_scrollbar.set)
        
        fields_canvas.pack(side="left", fill="both", expand=True)
        fields_scrollbar.pack(side="right", fill="y")
        
        # Display area
        display_frame = ttk.Frame(middle_frame)
        display_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Info label
        self.info_label = ttk.Label(display_frame, text="Load map data and image to generate minimaps")
        self.info_label.pack(pady=10)
        
        # Canvas for minimap display
        self.canvas = tk.Canvas(display_frame, bg='white')
        self.canvas.pack(fill=tk.BOTH, expand=True)
        
        # Navigation frame
        nav_frame = ttk.Frame(main_frame)
        nav_frame.pack(fill=tk.X, pady=(10, 0))
        
        self.prev_btn = ttk.Button(nav_frame, text="Previous", command=self.prev_minimap, state=tk.DISABLED)
        self.prev_btn.pack(side=tk.LEFT)
        
        self.minimap_info_label = ttk.Label(nav_frame, text="")
        self.minimap_info_label.pack(side=tk.LEFT, expand=True)
        
        self.next_btn = ttk.Button(nav_frame, text="Next", command=self.next_minimap, state=tk.DISABLED)
        self.next_btn.pack(side=tk.RIGHT)
        
    def load_map_data(self):
        file_path = filedialog.askopenfilename(
            title="Load Map Data",
            filetypes=[("JSON files", "*.json")]
        )
        if file_path:
            try:
                with open(file_path, 'r') as f:
                    self.map_data = json.load(f)
                
                messagebox.showinfo("Success", f"Loaded data with {len(self.map_data.get('fields', []))} fields")
                self.update_fields_list()
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load data: {str(e)}")
                
    def load_map_image(self):
        file_path = filedialog.askopenfilename(
            title="Load Map Image",
            filetypes=[("Image files", "*.png *.jpg *.jpeg *.gif *.bmp *.tiff")]
        )
        if file_path:
            try:
                self.original_image = Image.open(file_path)
                messagebox.showinfo("Success", f"Loaded map image: {self.original_image.size[0]}x{self.original_image.size[1]}")
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load image: {str(e)}")
                
    def regenerate_centers(self):
        """Regenerate optimal centers for all fields using raytracing"""
        if not self.map_data or not self.original_image:
            messagebox.showwarning("Warning", "Please load both map data and map image first.")
            return
            
        if 'fields' not in self.map_data or not self.map_data['fields']:
            messagebox.showwarning("Warning", "No fields found in map data.")
            return
            
        # Get map dimensions
        if 'map_size' in self.map_data:
            map_width = self.map_data['map_size']['width']
            map_height = self.map_data['map_size']['height']
        else:
            map_width, map_height = self.original_image.size
            
        updated_count = 0
        
        for field in self.map_data['fields']:
            if not field.get('points') or len(field['points']) < 3:
                continue
                
            # Find optimal center
            new_center = self.find_field_center(field['points'])
            if new_center:
                field['pinpoint'] = new_center
                
                # Recalculate radius from new center
                new_radius = self.calculate_field_radius(field, map_width, map_height)
                field['radius'] = new_radius
                
                updated_count += 1
                
        if updated_count > 0:
            self.update_fields_list()
            messagebox.showinfo("Success", f"Regenerated centers for {updated_count} fields")
        else:
            messagebox.showwarning("Warning", "No valid fields found to regenerate centers for.")
            
    def find_field_center(self, field_points):
        """Find the optimal center point of a field using geometric analysis"""
        if len(field_points) < 3:
            return None
            
        # Calculate centroid as starting point
        centroid_x = sum(p[0] for p in field_points) / len(field_points)
        centroid_y = sum(p[1] for p in field_points) / len(field_points)
        
        # Check if centroid is inside the polygon
        if self.point_in_polygon([centroid_x, centroid_y], field_points):
            return [centroid_x, centroid_y]
            
        # If centroid is outside, find the point inside the polygon that's closest to centroid
        # Use a grid search approach
        min_x = min(p[0] for p in field_points)
        max_x = max(p[0] for p in field_points)
        min_y = min(p[1] for p in field_points)
        max_y = max(p[1] for p in field_points)
        
        best_point = None
        best_score = float('-inf')
        
        # Grid resolution
        steps = 20
        step_x = (max_x - min_x) / steps
        step_y = (max_y - min_y) / steps
        
        for i in range(steps + 1):
            for j in range(steps + 1):
                test_x = min_x + i * step_x
                test_y = min_y + j * step_y
                test_point = [test_x, test_y]
                
                if self.point_in_polygon(test_point, field_points):
                    # Score based on minimum distance to edges (more central = higher score)
                    min_dist = self.min_distance_to_edges(test_point, field_points)
                    if min_dist > best_score:
                        best_score = min_dist
                        best_point = test_point
                        
        return best_point if best_point else [centroid_x, centroid_y]
        
    def point_in_polygon(self, point, polygon_points):
        """Check if a point is inside a polygon using ray casting"""
        x, y = point
        n = len(polygon_points)
        inside = False
        
        p1x, p1y = polygon_points[0]
        for i in range(1, n + 1):
            p2x, p2y = polygon_points[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
            
        return inside
        
    def min_distance_to_edges(self, point, polygon_points):
        """Calculate minimum distance from point to polygon edges"""
        import math
        
        min_dist = float('inf')
        px, py = point
        
        for i in range(len(polygon_points)):
            x1, y1 = polygon_points[i]
            x2, y2 = polygon_points[(i + 1) % len(polygon_points)]
            
            # Distance from point to line segment
            A = px - x1
            B = py - y1
            C = x2 - x1
            D = y2 - y1
            
            dot = A * C + B * D
            len_sq = C * C + D * D
            
            if len_sq == 0:
                # Degenerate line segment
                dist = math.sqrt(A * A + B * B)
            else:
                param = dot / len_sq
                
                if param < 0:
                    xx = x1
                    yy = y1
                elif param > 1:
                    xx = x2
                    yy = y2
                else:
                    xx = x1 + param * C
                    yy = y1 + param * D
                    
                dx = px - xx
                dy = py - yy
                dist = math.sqrt(dx * dx + dy * dy)
                
            min_dist = min(min_dist, dist)
            
        return min_dist
        
    def calculate_field_radius(self, field, map_width, map_height):
        """Calculate radius for minimap view using raycast from pin (same as original tool)"""
        if not field.get('pinpoint') or not field.get('points') or len(field['points']) < 3:
            # Default radius if no valid field
            default_radius = max(map_width, map_height) / 20
            return default_radius
            
        pin_x, pin_y = field['pinpoint']
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
        map_max_size = max(map_width, map_height)
        min_threshold = map_max_size / 100
        
        if hit_count == 0 or max_distance < min_threshold:
            # Use default radius
            radius = map_max_size / 20
        else:
            # Add 10% buffer to the maximum distance
            radius = max_distance * 1.1
            
        return radius
                
    def update_fields_list(self):
        # Clear existing field list
        for widget in self.fields_frame_inner.winfo_children():
            widget.destroy()
            
        if not self.map_data or 'fields' not in self.map_data:
            return
            
        # Add field entries
        for i, field in enumerate(self.map_data['fields']):
            frame = ttk.Frame(self.fields_frame_inner)
            frame.pack(fill=tk.X, pady=2)
            
            # Color indicator
            color_canvas = tk.Canvas(frame, width=20, height=20, bg=field.get('color', '#000000'))
            color_canvas.pack(side=tk.LEFT, padx=(0, 5))
            
            # Field info
            info_text = f"{field.get('fieldname', 'Unnamed')}\nRadius: {field.get('radius', 0):.1f}px"
            ttk.Label(frame, text=info_text).pack(side=tk.LEFT, anchor=tk.W)
            
            # View button
            view_btn = ttk.Button(frame, text="View", 
                                command=lambda idx=i: self.view_minimap(idx))
            view_btn.pack(side=tk.RIGHT)
            
    def generate_minimaps(self):
        if not self.map_data or not self.original_image:
            messagebox.showwarning("Warning", "Please load both map data and map image first.")
            return
            
        if 'fields' not in self.map_data:
            messagebox.showwarning("Warning", "No fields found in map data.")
            return
            
        self.minimap_images = []
        
        for field in self.map_data['fields']:
            minimap = self.create_minimap(field)
            if minimap:
                self.minimap_images.append({
                    'image': minimap,
                    'field': field
                })
                
        if self.minimap_images:
            self.current_minimap_index = 0
            self.display_current_minimap()
            self.prev_btn.config(state=tk.NORMAL)
            self.next_btn.config(state=tk.NORMAL)
            
            messagebox.showinfo("Success", f"Generated {len(self.minimap_images)} minimaps")
        else:
            messagebox.showwarning("Warning", "No valid minimaps could be generated.")
            
    def create_minimap(self, field):
        """Create a square minimap centered on the field's pin location"""
        if not field.get('pinpoint') or not field.get('radius'):
            return None
            
        pin_x, pin_y = field['pinpoint']
        radius = field['radius']
        
        # Get field color early to avoid reference errors later
        color = field.get('color', '#FF0000')
        
        # Calculate square bounds
        left = int(pin_x - radius)
        top = int(pin_y - radius)
        right = int(pin_x + radius)
        bottom = int(pin_y + radius)
        
        # Ensure bounds are within image
        img_width, img_height = self.original_image.size
        left = max(0, left)
        top = max(0, top)
        right = min(img_width, right)
        bottom = min(img_height, bottom)
        
        # Create square by using the smaller dimension
        width = right - left
        height = bottom - top
        square_size = min(width, height)
        
        # Ensure we have a valid square size
        if square_size <= 0:
            print(f"Invalid square size for {field.get('fieldname', 'Unknown')}: {square_size}")
            return None
        
        # Recalculate bounds to make it perfectly square and centered
        center_x = (left + right) // 2
        center_y = (top + bottom) // 2
        half_size = square_size // 2
        
        left = max(0, center_x - half_size)
        top = max(0, center_y - half_size)
        right = min(img_width, left + square_size)
        bottom = min(img_height, top + square_size)
        
        # Final validation to ensure valid crop coordinates
        if right <= left or bottom <= top:
            # Adjust to ensure valid coordinates
            if right <= left:
                if left + 1 <= img_width:
                    right = left + 1
                else:
                    left = right - 1
                    
            if bottom <= top:
                if top + 1 <= img_height:
                    bottom = top + 1
                else:
                    top = bottom - 1
                    
            # Recalculate square_size based on corrected bounds
            width = right - left
            height = bottom - top
            square_size = min(width, height)
        
        # Crop the image
        try:
            cropped = self.original_image.crop((left, top, right, bottom))
            
            # Draw field overlay if points exist
            if field.get('points') and len(field['points']) > 2:
                overlay_image = cropped.copy()
                draw = ImageDraw.Draw(overlay_image, 'RGBA')
                
                # Adjust points relative to crop
                adjusted_points = []
                for point in field['points']:
                    adj_x = point[0] - left
                    adj_y = point[1] - top
                    # Don't filter out points - include all for proper polygon drawing
                    adjusted_points.append((adj_x, adj_y))
                
                # Draw field boundary and fill if we have enough points
                if len(adjusted_points) > 2:
                    # Fill polygon with transparency
                    fill_color = tuple(list(self.hex_to_rgb(color)) + [64])  # 25% opacity
                    draw.polygon(adjusted_points, fill=fill_color, outline=color, width=2)
                
                # Draw pin location
                pin_rel_x = pin_x - left
                pin_rel_y = pin_y - top
                if 0 <= pin_rel_x <= square_size and 0 <= pin_rel_y <= square_size:
                    pin_size = 6
                    draw.ellipse([pin_rel_x-pin_size, pin_rel_y-pin_size, 
                                pin_rel_x+pin_size, pin_rel_y+pin_size], 
                               fill=color, outline='black', width=2)
                    
                    # Draw field name
                    try:
                        from PIL import ImageFont
                        font = ImageFont.truetype("arial.ttf", 14)
                    except:
                        font = None
                    
                    text_x = pin_rel_x + pin_size + 2
                    text_y = pin_rel_y - pin_size
                    
                    # Draw text with outline
                    outline_offsets = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
                    for offset_x, offset_y in outline_offsets:
                        draw.text((text_x + offset_x, text_y + offset_y), 
                                field.get('fieldname', 'Unnamed'), fill='black', font=font)
                    draw.text((text_x, text_y), field.get('fieldname', 'Unnamed'), 
                            fill='white', font=font)
                
                return overlay_image
            else:
                return cropped
                
        except Exception as e:
            print(f"Error creating minimap for {field.get('fieldname', 'Unknown')}: {e}")
            return None
            
    def hex_to_rgb(self, hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        
    def view_minimap(self, field_index):
        """View a specific minimap"""
        if not self.minimap_images:
            messagebox.showwarning("Warning", "Please generate minimaps first.")
            return
            
        if 0 <= field_index < len(self.minimap_images):
            self.current_minimap_index = field_index
            self.display_current_minimap()
            
    def display_current_minimap(self):
        """Display the current minimap"""
        if not self.minimap_images or self.current_minimap_index >= len(self.minimap_images):
            return
            
        minimap_data = self.minimap_images[self.current_minimap_index]
        image = minimap_data['image']
        field = minimap_data['field']
        
        # Resize image to fit canvas (max 500x500)
        display_size = 500
        if image.width > display_size or image.height > display_size:
            image = image.resize((display_size, display_size), Image.Resampling.LANCZOS)
        
        self.photo = ImageTk.PhotoImage(image)
        self.canvas.delete("all")
        
        # Center the image
        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()
        x = (canvas_width - image.width) // 2
        y = (canvas_height - image.height) // 2
        
        self.canvas.create_image(x, y, anchor=tk.NW, image=self.photo)
        
        # Update info labels
        field_name = field.get('fieldname', 'Unnamed')
        radius = field.get('radius', 0)
        self.info_label.config(text=f"Field: {field_name} | Radius: {radius:.1f}px | Size: {image.width}x{image.height}")
        
        self.minimap_info_label.config(text=f"Minimap {self.current_minimap_index + 1} of {len(self.minimap_images)}")
        
    def prev_minimap(self):
        if self.minimap_images and self.current_minimap_index > 0:
            self.current_minimap_index -= 1
            self.display_current_minimap()
            
    def next_minimap(self):
        if self.minimap_images and self.current_minimap_index < len(self.minimap_images) - 1:
            self.current_minimap_index += 1
            self.display_current_minimap()
            
    def save_all_minimaps(self):
        if not self.minimap_images:
            messagebox.showwarning("Warning", "No minimaps to save. Generate minimaps first.")
            return
            
        folder_path = filedialog.askdirectory(title="Select folder to save minimaps")
        if not folder_path:
            return
            
        try:
            saved_count = 0
            for i, minimap_data in enumerate(self.minimap_images):
                image = minimap_data['image']
                field = minimap_data['field']
                field_name = field.get('fieldname', f'field_{i}')
                
                # Clean filename
                safe_name = "".join(c for c in field_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
                filename = f"{safe_name}_minimap.png"
                filepath = os.path.join(folder_path, filename)
                
                image.save(filepath)
                saved_count += 1
                
            messagebox.showinfo("Success", f"Saved {saved_count} minimaps to {folder_path}")
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save minimaps: {str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = MinimapZoomViewer(root)
    root.mainloop()