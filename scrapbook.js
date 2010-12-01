(function ()
{
    var canvas_manager,
        canvas_el = document.getElementById("canvas");
    
    canvas_manager = (function (canvas_el)
    {
        var canvas = {
            height: 600,
            width:  800
        },
            context = canvas_el.getContext("2d"),
            layers = [],
            
            hover_layer    = -1,
            last_layer     = -1,
            selected_layer = -1,
            
            cur_action,
            
            action_idle   = 0,
            action_move   = 1,
            action_scale  = 2,
            action_rotate = 3,
            action_crop   = 4;
        
        canvas_el.style.background = "#FFF";
        
        /// Width and height must be set with setAttribute() to avoid stretching.
        canvas_el.setAttribute("width",  canvas.width);
        canvas_el.setAttribute("height", canvas.height);
        
        function redraw()
        {
            ///TODO: redraw() should take dimension or a layer as a parameter and only redraw that part.
            
            var cur_layer,
                i = 0,
                layer_count = layers.length;
            
            ///TODO: Use last_layer to figure out what parts need to be redrawn.
            
            /// Redraw the entire canvas.
            canvas_el.setAttribute("width",  canvas.width);
            
            while (i < layer_count) {
                /// If visible
                cur_layer = layers[i];
                context.save();
                
                context.globalAlpha              = cur_layer.opacity;
                context.globalCompositeOperation = cur_layer.composite;
                
                /// If an image
                context.drawImage(cur_layer.img, cur_layer.x, cur_layer.y, cur_layer.width, cur_layer.height);
                
                context.restore();
                ++i;
            }
            
            /// Is this the active layer?
            if (selected_layer >= 0) {
                cur_layer = layers[selected_layer];
                /// Determine the type of decorations to draw.
                context.moveTo(cur_layer.x - 5.5, cur_layer.y - 5.5);
                context.lineTo(cur_layer.x + 5.5, cur_layer.y - 5.5);
                context.lineTo(cur_layer.x + 5.5, cur_layer.y + 5.5);
                context.lineTo(cur_layer.x - 5.5, cur_layer.y + 5.5);
                context.lineTo(cur_layer.x - 5.5, cur_layer.y - 5.5);
                context.strokeStyle = "rgba(0,0,0,.5)";
                context.stroke();
            }
        }
        
        function create_new_layer(type, img, x, y, text)
        {
            var obj,
                shrink_by;
            
            obj = {
                angle:     0,
                composite: "source-over",
                opacity:   1,
                type:      type,
                x:         x,
                y:         y
            }
            
            if (type == "img") {
                obj.img    = img;
                obj.orig_h = img.height;
                obj.orig_w = img.width;
                
                if (obj.orig_h > canvas.height || obj.orig_w > canvas.width) {
                    /// Is the height the biggest problem?
                    if (obj.orig_h - canvas.height > obj.orig_w - canvas.width) {
                        shrink_by = canvas.height / obj.orig_h;
                    } else {
                        shrink_by = canvas.width / obj.orig_w;
                    }
                    obj.height = Math.floor(obj.orig_h * shrink_by);
                    obj.width  = Math.floor(obj.orig_w * shrink_by);
                } else {
                    obj.height = obj.orig_h;
                    obj.width  = obj.orig_w;
                }
            } else {
                obj.text = text;
            }
            
            return obj;
        }
    
        function add_image(dataURI, x, y)
        {
            var img = new Image();
            img.onload = function ()
            {
                /// Prevent an image from being created off of the page (this could happen when dropping multiple images).
                if (x > canvas.width - 5) {
                    x = canvas.width - 5;
                }
                if (y > canvas.height - 5) {
                    y = canvas.height - 5;
                }
                layers[layers.length] = create_new_layer("img", img, x, y);
                redraw();
            };
            img.src = dataURI;
        }
        
        function get_relative_x_y(e)
        {
            var posX = 0,
                posY = 0;
            
            if (e.pageX || e.pageY) {
                posX = e.pageX;
                posY = e.pageY;
            } else if (e.clientX || e.clientY) {
                posX = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
                posY = e.clientY + document.body.scrollTop  + document.documentElement.scrollTop;
            }
            
            return {
                x: posX - canvas_el.offsetLeft,
                y: posY - canvas_el.offsetTop
            };
        }
        
        
        (function ()
        {
            var button_down = false,
                button_state,
                
                layer_starting_x,
                layer_starting_y,
                mouse_starting_x,
                mouse_starting_y;
            
            canvas_el.onmousemove = function (e)
            {
                var cur_layer,
                    cur_pos = get_relative_x_y(e),
                    cur_x,
                    cur_y,
                    i,
                    layer_count;
                
                cur_x = cur_pos.x;
                cur_y = cur_pos.y;
                
                if (button_down) {
                    if (selected_layer >= 0) {
                        //document.title = mouse_starting_x + " " + cur_x + ", " + mouse_starting_y + " " + cur_y;
                        cur_layer = layers[selected_layer];
                        cur_layer.x = layer_starting_x + (cur_x - mouse_starting_x);
                        cur_layer.y = layer_starting_y + (cur_y - mouse_starting_y);
                        document.title = cur_layer.y;
                        redraw();
                    }
                } else {
                    /// Is the cursor hovering over something?
                    i = layers.length - 1;
                    
                    
                    ///TODO First determine if it is hovering over a decoration.
                    
                    /// Go through the layers backward (starting with the top).
                    while (i >= 0) {
                        cur_layer = layers[i];
                        /// If visible
                        ///TODO: Make a bounding box measurement for rotated elements.
                        if (cur_layer.angle === 0) {
                            if (cur_layer.x <= cur_x && cur_layer.x + cur_layer.width >= cur_x && cur_layer.y <= cur_y && cur_layer.y + cur_layer.height >= cur_y) {
                                document.title = i;
                                break;
                            }
                        }
                        --i;
                    }
                    
                    /// Is the mouse hovering over a layer?
                    if (hover_layer !== i) {
                        hover_layer = i
                        //redraw();
                        if (hover_layer >= 0) {
                            canvas_el.style.cursor = "move";
                        } else {
                            canvas_el.style.cursor = "auto";
                        }
                    }
                }
            }
            
            canvas_el.onmousedown = function (e)
            {
                var cur_pos = get_relative_x_y(e);
                
                button_state = e.button;
                button_down  = true;
                
                
                /// Store the last layer so that it doesn't have to redraw the entire page.
                last_layer     = selected_layer;
                selected_layer = hover_layer;
                
                if (last_layer != selected_layer) {
                    redraw();
                    
                    /// Last layer is no longer needed since it finished redrawing the parts that changed.
                    last_layer = -1;
                }
                
                if (selected_layer >= 0) {
                    ///TODO: This needs to be determined.
                    cur_action = action_move;
                    
                    mouse_starting_x = cur_pos.x;
                    mouse_starting_y = cur_pos.y;
                    
                    layer_starting_x = layers[selected_layer].x;
                    layer_starting_y = layers[selected_layer].y;
                }
            }
            
            canvas_el.onmouseup = function (e)
            {
                button_state = e.button;
                button_down  = false;
            }
        }());
        
        return {
            add_image:        add_image,
            get_relative_x_y: get_relative_x_y
        };
    }(canvas_el));
    
    
    function handleReadernotification(e)
    {
        if (e.lengthComputable) {
            /// Percent = e.loaded / e.total;
            document.title = e.loaded / e.total;
        }
    }
    
    
    function ignore_event(e)
    {
        e.stopPropagation();
        e.preventDefault();
    }
    
    function drop(e)
    {
        var count,
            file,
            files = e.dataTransfer.files,
            i,
            offset_count = 0,
            reader;
        
        e.stopPropagation();
        e.preventDefault();
        
        count = files.length;
        
        /// Only call the handler if one or more files were dropped.
        if (count < 1) {
            alert("ERROR: No files were dropped.");
            return;
        }
        
        for (i = 0; i < count; ++i) {
            file   = files[i];
            reader = new FileReader();
            
            /// Initialize the reader event handlers
            reader.onnotification = handleReadernotification; /// Does anything use this?
            reader.onprogress     = handleReadernotification;
            reader.onloadstart    = handleReadernotification;
            reader.onloadend      = function (e2)
            {   
                var cur_pos = canvas_manager.get_relative_x_y(e);
                /// offset_count moves the images over slightly when dropping more than one at a time in order to see them all  .
                canvas_manager.add_image(e2.target.result, cur_pos.x + (offset_count * 15), cur_pos.y + (offset_count * 15));
                ++offset_count;
            };
            
            /// Begin reading in files.
            reader.readAsDataURL(file);
        }
    }

    
    canvas_el.addEventListener("dragenter", ignore_event, false);
    canvas_el.addEventListener("dragexit",  ignore_event, false);
    canvas_el.addEventListener("dragover",  ignore_event, false);
    canvas_el.addEventListener("drop",      drop,         false);
    
}());