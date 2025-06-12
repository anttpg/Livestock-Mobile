# This script is used for moving labeled photos of the cows into their proper folders.
# THIS SCRIPT WILL HAVE TO BE MODIFIED IF YOU USE A DIFFERENT NAMING SCHEME
# 
# Cowtags are assumed to be alphanumeric. NT means no tag
# Ex; 

# 49B BODY.JPG
# NT SPOT BODY.JPG

import os
import shutil
import re
from datetime import datetime
from tkinter import filedialog, messagebox, simpledialog
import tkinter as tk
from pathlib import Path

class CowPhotoOrganizer:
    def __init__(self):
        self.source_folder = ""
        self.destination_folder = ""
        self.cow_tags = {}
        self.no_tag_files = []
        self.unusual_names = []
        self.processed_files = []
        self.skipped_files = []
        
    def select_folders(self):
        """Prompt user to select source and destination folders"""
        root = tk.Tk()
        root.withdraw()  # Hide the main window
        
        print("Select the SOURCE folder containing the cow photos...")
        self.source_folder = filedialog.askdirectory(title="Select Source Folder")
        if not self.source_folder:
            print("No source folder selected. Exiting.")
            return False
            
        print("Select the DESTINATION folder where organized photos will be saved...")
        self.destination_folder = filedialog.askdirectory(title="Select Destination Folder")
        if not self.destination_folder:
            print("No destination folder selected. Exiting.")
            return False
            
        print(f"Source folder: {self.source_folder}")
        print(f"Destination folder: {self.destination_folder}")
        return True
    
    def parse_cow_tag(self, filename):
        """Extract cow tag from filename"""
        # Remove file extension
        name = filename.upper().replace('.JPG', '').replace('.JPEG', '')
        
        # This is just based on the orignal photo names I had
        if 'NT' in name:
            return 'NT'
        
        if 'UNKOWN' in name or 'UNKNOWN' in name or 'IMG_' in name:
            return 'UNKNOWN'
            
        if 'DONKEY' in name:
            return 'DONKEY'
            
        if 'FIND CALF' in name:
            return 'UNKNOWN'
            
        if 'GRASS LOL' in name:
            return None
            
        if 'MUNCH MUNCH' in name:
            return None
        
        # Look for patterns like "R25", "TK2", etc. at the start
        match = re.match(r'^([A-Z]+\d+)', name)
        if match:
            return match.group(1)
        
        # Look for patterns like "17A", "17B", "2A", etc.
        match = re.match(r'^(\d+[A-Z]+)', name)
        if match:
            return match.group(1)
        
        # Look for just numbers at the start
        match = re.match(r'^(\d+)', name)
        if match:
            return match.group(1)
        
        # Look for just letters at the start (but not BODY, HEAD, etc.)
        match = re.match(r'^([A-Z]+)', name)
        if match and match.group(1) not in ['BODY', 'HEAD', 'PROFILE', 'CALF']:
            return match.group(1)
        
        return None
    
    def get_body_type(self, filename):
        """Extract body type from filename"""
        name = filename.upper()
        
        if 'BODY' in name:
            return 'BODY'
        elif 'HEAD' in name:
            return 'HEAD'
        elif 'PROFILE' in name:
            return 'PROFILE'
        elif 'CALF' in name:
            return 'CALF'
        else:
            return 'BODY'  # Default to BODY if unclear
    
    def is_unusual_name(self, cow_tag):
        """Check if cow tag seems unusual and needs confirmation"""
        if not cow_tag:
            return True
            
        # Greater than 4 characters
        if len(cow_tag) > 4:
            return True
            
        # Contains non-alphanumeric characters
        if not cow_tag.isalnum():
            return True
            
        # Contains body/head/profile keywords
        if any(word in cow_tag.upper() for word in ['BODY', 'HEAD', 'PROFILE']):
            return True
            
        # Contains NT (No Tag)
        if 'NT' in cow_tag:
            return True
            
        # Contains UNKNOWN
        if 'UNKNOWN' in cow_tag:
            return True
            
        return False
    
    def scan_photos(self):
        """Scan all photos in source folder and extract cow tags"""
        print("Scanning photos for cow tags...")
        
        image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
        
        for filename in os.listdir(self.source_folder):
            if any(filename.lower().endswith(ext) for ext in image_extensions):
                cow_tag = self.parse_cow_tag(filename)
                
                if cow_tag is None:
                    self.no_tag_files.append(filename)
                else:
                    if cow_tag not in self.cow_tags:
                        self.cow_tags[cow_tag] = []
                    self.cow_tags[cow_tag].append(filename)
                    
                    if self.is_unusual_name(cow_tag):
                        if cow_tag not in self.unusual_names:
                            self.unusual_names.append(cow_tag)
        
        print(f"Found {len(self.cow_tags)} unique cow tags")
        print(f"Found {len(self.no_tag_files)} files with no identifiable tags")
        
        if self.no_tag_files:
            print("\nFiles with no identifiable tags:")
            for filename in self.no_tag_files:
                print(f"  - {filename}")
    
    def confirm_unusual_names(self):
        """Ask user to confirm unusual cow tag names"""
        if not self.unusual_names:
            return
            
        print(f"\nFound {len(self.unusual_names)} unusual cow tag names that need confirmation:")
        
        confirmed_tags = {}
        root = tk.Tk()
        root.withdraw()
        
        for tag in self.unusual_names:
            files_with_tag = self.cow_tags.get(tag, [])
            message = f"Unusual cow tag found: '{tag}'\n\nFiles with this tag:\n"
            for i, filename in enumerate(files_with_tag[:5]):  # Show first 5 files
                message += f"  - {filename}\n"
            if len(files_with_tag) > 5:
                message += f"  ... and {len(files_with_tag) - 5} more files\n"
            
            message += f"\nDo you want to:\n1. Keep as '{tag}'\n2. Rename it\n3. Skip these files"
            
            choice = messagebox.askyesnocancel("Confirm Unusual Cow Tag", 
                                             f"{message}\n\nClick Yes to keep, No to rename, Cancel to skip")
            
            if choice is True:  # Keep as is
                confirmed_tags[tag] = tag
            elif choice is False:  # Rename
                new_name = simpledialog.askstring("Rename Cow Tag", 
                                                 f"Enter new name for cow tag '{tag}':")
                if new_name:
                    confirmed_tags[tag] = new_name.upper()
                else:
                    confirmed_tags[tag] = None  # Skip
            else:  # Skip
                confirmed_tags[tag] = None
        
        # Update cow_tags with confirmed names
        updated_cow_tags = {}
        for old_tag, new_tag in confirmed_tags.items():
            if new_tag:  # Not skipped
                files = self.cow_tags[old_tag]
                if new_tag not in updated_cow_tags:
                    updated_cow_tags[new_tag] = []
                updated_cow_tags[new_tag].extend(files)
        
        # Add non-unusual tags
        for tag, files in self.cow_tags.items():
            if tag not in self.unusual_names:
                updated_cow_tags[tag] = files
        
        self.cow_tags = updated_cow_tags
    
    def format_date(self, timestamp):
        """Format timestamp to dayMonthYear format"""
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        day = timestamp.day
        month = months[timestamp.month - 1]
        year = timestamp.year
        
        return f"{day:02d}{month}{year}"
    
    def organize_photos(self):
        """Create folders and copy photos with new naming convention"""
        print("\nOrganizing photos...")
        
        for cow_tag, filenames in self.cow_tags.items():
            # Create cow folder
            cow_folder = os.path.join(self.destination_folder, cow_tag)
            os.makedirs(cow_folder, exist_ok=True)
            
            for filename in filenames:
                source_path = os.path.join(self.source_folder, filename)
                
                # Get file timestamp
                try:
                    timestamp = datetime.fromtimestamp(os.path.getmtime(source_path))
                    date_str = self.format_date(timestamp)
                except:
                    date_str = "01Jan2022"  # Fallback date
                
                # Determine body type
                body_type = self.get_body_type(filename)
                
                # Create new filename
                base_name = f"{cow_tag} {body_type} {date_str}"
                new_filename = f"{base_name}.jpg"
                
                # Handle duplicates by adding number suffix
                counter = 1
                while os.path.exists(os.path.join(cow_folder, new_filename)):
                    new_filename = f"{base_name} ({counter}).jpg"
                    counter += 1
                    
                    if counter == 1:  # First duplicate found
                        print(f"Duplicate found for {base_name}.jpg - adding number suffix")
                
                destination_path = os.path.join(cow_folder, new_filename)
                
                try:
                    # Copy file (preserves timestamps)
                    shutil.copy2(source_path, destination_path)
                    self.processed_files.append((filename, new_filename, cow_tag))
                    print(f"Copied: {filename} -> {cow_tag}/{new_filename}")
                except Exception as e:
                    print(f"Error copying {filename}: {e}")
                    self.skipped_files.append((filename, str(e)))
    
    def print_summary(self):
        """Print summary of operations"""
        print(f"\n{'='*50}")
        print("SUMMARY")
        print(f"{'='*50}")
        print(f"Total files processed: {len(self.processed_files)}")
        print(f"Total cow folders created: {len(self.cow_tags)}")
        print(f"Files with no identifiable tags: {len(self.no_tag_files)}")
        print(f"Files skipped due to errors: {len(self.skipped_files)}")
        
        if self.skipped_files:
            print("\nFiles skipped due to errors:")
            for filename, error in self.skipped_files:
                print(f"  - {filename}: {error}")
        
        print(f"\nOrganized photos are saved in: {self.destination_folder}")
    
    def run(self):
        """Main execution method"""
        print("Cow Photo Organizer")
        print("="*50)
        
        if not self.select_folders():
            return
        
        self.scan_photos()
        self.confirm_unusual_names()
        self.organize_photos()
        self.print_summary()

if __name__ == "__main__":
    organizer = CowPhotoOrganizer()
    organizer.run()