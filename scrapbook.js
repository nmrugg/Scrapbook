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
            cur_decoration_mode,
            
            
            action_idle   = 0,
            action_move   = 1,
            action_scale  = 2,
            action_rotate = 3,
            action_crop   = 4,
            
            decoration_resize = 1,
            decoration_rotate = 2,
            decoration_crop   = 3;
        
        cur_decoration_mode = decoration_resize;
        
        canvas_el.style.background = "#FFF";
        
        /// Width and height must be set with setAttribute() to avoid stretching.
        canvas_el.setAttribute("width",  canvas.width);
        canvas_el.setAttribute("height", canvas.height);
        
        
        function draw_decoration(cur_layer)
        {
            var corners,
                
                cur_x,
                cur_y,
                cur_x2,
                cur_y2;
            
            context.save();
            
            if (cur_layer.angle != 0) {
                
                cur_layer.decoration_points = {
                    ///TODO: Figure out exactly where the points should be.
                    ul: rotate_rect(cur_layer.angle, cur_layer.rotated_points.x1 - 4.5, cur_layer.rotated_points.y1 - 4.5, 10, 10),
                    ur: rotate_rect(cur_layer.angle, cur_layer.rotated_points.x2 - 6.5, cur_layer.rotated_points.y2 - 4.5, 10, 10),
                    br: rotate_rect(cur_layer.angle, cur_layer.rotated_points.x3 - 6.5, cur_layer.rotated_points.y3 - 6.5, 10, 10),
                    bl: rotate_rect(cur_layer.angle, cur_layer.rotated_points.x4 - 4.5, cur_layer.rotated_points.y4 - 6.5, 10, 10)
                }
            } else {
                cur_x = cur_layer.x;
                cur_y = cur_layer.y;
                
                cur_x2 = cur_x + cur_layer.width;
                cur_y2 = cur_y + cur_layer.height;
                
                cur_layer.decoration_points = {
                    ul: {x1: cur_x  - 4.5, y1: cur_y  - 4.5, x2: cur_x  + 6.5, y2: cur_y  - 4.5, x3: cur_x  + 6.5, y3: cur_y  + 6.5, x4: cur_x  - 4.5, y4: cur_y  + 6.5},
                    ur: {x1: cur_x2 - 6.5, y1: cur_y  - 4.5, x2: cur_x2 + 4.5, y2: cur_y  - 4.5, x3: cur_x2 + 4.5, y3: cur_y  + 6.5, x4: cur_x2 - 6.5, y4: cur_y  + 6.5},
                    br: {x1: cur_x2 - 6.5, y1: cur_y2 - 6.5, x2: cur_x2 + 4.5, y2: cur_y2 - 6.5, x3: cur_x2 + 4.5, y3: cur_y2 + 4.5, x4: cur_x2 - 6.5, y4: cur_y2 + 4.5},
                    bl: {x1: cur_x  - 4.5, y1: cur_y2 - 6.5, x2: cur_x  + 6.5, y2: cur_y2 - 6.5, x3: cur_x  + 6.5, y3: cur_y2 + 4.5, x4: cur_x  - 4.5, y4: cur_y2 + 4.5}
                }
            }
            
            switch (cur_decoration_mode) {
            case decoration_resize:
                
                for (corners in cur_layer.decoration_points) {
                    context.moveTo(cur_layer.decoration_points[corners].x1, cur_layer.decoration_points[corners].y1);
                    context.lineTo(cur_layer.decoration_points[corners].x2, cur_layer.decoration_points[corners].y2);
                    context.lineTo(cur_layer.decoration_points[corners].x3, cur_layer.decoration_points[corners].y3);
                    context.lineTo(cur_layer.decoration_points[corners].x4, cur_layer.decoration_points[corners].y4);
                    context.lineTo(cur_layer.decoration_points[corners].x1, cur_layer.decoration_points[corners].y1);
                }
                
                context.strokeStyle = "rgba(0,0,0,.5)";
                context.stroke();
                
                break;
            case decoration_rotate:
                break;
            case decoration_crop:
                break;
            }
            
            context.restore();
        }
        
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
                
                /// If rotated
                if (cur_layer.angle !== 0) {
                    context.translate(cur_layer.x + (cur_layer.width / 2), cur_layer.y + (cur_layer.height / 2));
                    context.rotate(cur_layer.angle);
                    /// If an image
                    context.drawImage(cur_layer.img, 0 - (cur_layer.width / 2), 0 - (cur_layer.height / 2), cur_layer.width, cur_layer.height);
                } else {
                    /// If an image
                    context.drawImage(cur_layer.img, cur_layer.x, cur_layer.y, cur_layer.width, cur_layer.height);
                }
                
                context.restore();
                ++i;
            }
            
            /// Is this the active layer?
            if (selected_layer >= 0) {
                draw_decoration(layers[selected_layer]);
            }
        }
        
        function create_new_layer(type, img, x, y, text)
        {
            var fit_into_height,
                fit_into_width,
                obj,
                shrink_by;
            
            obj = {
                angle:     0,
                composite: "source-over",
                opacity:   1,
                
                decoration_points: {},
                rotated_points:    {},
                
                type: type,
                
                x: x,
                y:  y
            }
            
            if (type == "img") {
                obj.img    = img;
                obj.orig_w = img.width;
                obj.orig_h = img.height;
                
                fit_into_width  = canvas.width  - (canvas.width  * .35);
                fit_into_height = canvas.height - (canvas.height * .35);
                
                if (obj.orig_h > fit_into_height || obj.orig_w > fit_into_width) {
                    /// Is the height the biggest problem?
                    if (obj.orig_h - fit_into_height > obj.orig_w - fit_into_width) {
                        shrink_by = fit_into_height / obj.orig_h;
                    } else {
                        shrink_by = fit_into_width  / obj.orig_w;
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
        
        
        /**
         * Rotate points of a rectangle around its center.
         *
         * @param angle The Angle in radians to rotate.
         * @param x     The upper left corner x coordinate.
         * @param y     The upper left corner y coordinate.
         * @param w     The width of the rectangle.
         * @param h     The height of the rectangle.
         */
        function rotate_rect(angle, x, y, w, h)
        {
            var center_x,
                center_y,
                x1,
                x2,
                y1,
                y2;
            
            center_x = x + (w / 2);
            center_y = y + (h / 2);
            
            /// Get points relative to the center of the rectangle.
            x1 = x - center_x;
            y1 = y - center_y;
            x2 = (x + w) - center_x;
            y2 = (y + h) - center_y;
            
            return {
                x1: Math.round(((Math.cos(angle) * x1 - Math.sin(angle) * y1) + center_x) * 100) / 100,
                y1: Math.round(((Math.sin(angle) * x1 + Math.cos(angle) * y1) + center_y) * 100) / 100,
                
                x2: Math.round(((Math.cos(angle) * x2 - Math.sin(angle) * y1) + center_x) * 100) / 100,
                y2: Math.round(((Math.sin(angle) * x2 + Math.cos(angle) * y1) + center_y) * 100) / 100,
                
                x3: Math.round(((Math.cos(angle) * x2 - Math.sin(angle) * y2) + center_x) * 100) / 100,
                y3: Math.round(((Math.sin(angle) * x2 + Math.cos(angle) * y2) + center_y) * 100) / 100,
            
                x4: Math.round(((Math.cos(angle) * x1 - Math.sin(angle) * y2) + center_x) * 100) / 100,
                y4: Math.round(((Math.sin(angle) * x1 + Math.cos(angle) * y2) + center_y) * 100) / 100
            }
        }
        
        
        function rotate(cur_layer, angle)
        {            
            angle *= Math.PI / 180;
            
            cur_layer.angle = angle;
            
            if (angle !== 0) {
                cur_layer.rotated_points = rotate_rect(angle, cur_layer.x, cur_layer.y, cur_layer.width, cur_layer.height);
            }
        }
        
        function add_image(dataURI, x, y)
        {
            var img = new Image();
            img.onload = function ()
            {
                /// It might be nice place the image relative to the center, but if the image is shurnk, it will not be correct.
                //x -= img.width  / 2;
                //y -= img.height / 2;
                
                /// Prevent an image from being created off of the page (this could happen when dropping multiple images).
                if (x > canvas.width - 5) {
                    x = canvas.width - 5;
                }
                if (y > canvas.height - 5) {
                    y = canvas.height - 5;
                }
                
                layers[layers.length] = create_new_layer("img", img, x, y);
                
                rotate(layers[layers.length - 1], 33);
                
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
                mouse_starting_y,
                
                get_layer_from_pos;
            
            get_layer_from_pos = (function ()
            {
                function is_inside_shape(x0, y0, shape)
                {
                    var point = 0,
                        points_length = shape.length,
                        positive,
                        sign,
                        x1,
                        x2,
                        y1,
                        y2;
                    
                    while (point < points_length) {
                        x1 = shape[point].x;
                        y1 = shape[point].y;
                        
                        /// If this is the last point, use the first point.
                        if (point + 1 === points_length) {
                            x2 = shape[0].x;
                            y2 = shape[0].y;
                        } else {
                            x2 = shape[point + 1].x;
                            y2 = shape[point + 1].y;
                        }
                        
                        ///NOTE: If the area of a triangle is taken in counter-clockwise order, the area will be positive (negitive otherwise)
                        ///      If the area is always the same sign (either always positive or always negative) that means the point is inside the shape.
                        sign = (x1 * y2 - y1 * x2 - x0 * y2 + y0 * x2 + x0 * y1 - y0 * x1) > 0;
                        
                        /// Since this is the first time, just store whether or not the area is positive.
                        if (point === 0) {
                            positive = sign;
                        } else {
                            /// If the area is ever a different sign then the point is not in the shape.
                            if (positive !== sign) {
                                return false;
                            }
                        }
                        
                        ++point;
                    }
                    
                    /// The area was always the same sign so the point is inside the shape.
                    return true;
                }
                
                return function (cur_pos)
                {
                    var cur_layer,
                        cur_x = cur_pos.x,
                        cur_y = cur_pos.y,
                        i,
                        layer_count;
                    
                    
                    /// First, check to see if the cursor is hovering over a decoration.
                    if (selected_layer >= 0) {
                        cur_layer = layers[selected_layer];
                        /// If not rotated
                        ///TODO: Since the algerithm for the rotated object is almsot as fast, rotated and unrotated could be merged together.
                        if (cur_layer.angle === 0) {
                            ///NOTE: Move and Crop decorations are both squares.
                            if (cur_decoration_mode != decoration_rotate) {
                                /// Upper left corner
                                if (cur_layer.x - 5 <= cur_x && cur_layer.x + 5 >= cur_x && cur_layer.y - 5 <= cur_y && cur_layer.y + 5 >= cur_y) {
                                    /// Is there a better way to return this info?
                                    document.title = "ul";
                                    return "ul";
                                } else if (cur_layer.x + cur_layer.width - 5 <= cur_x && cur_layer.x + cur_layer.width + 5 >= cur_x && cur_layer.y - 5 <= cur_y && cur_layer.y + 5 >= cur_y) {
                                    /// Is there a better way to return this info?
                                    document.title = "ur";
                                    return "ur";
                                } else if (cur_layer.x + cur_layer.width - 5 <= cur_x && cur_layer.x + cur_layer.width + 5 >= cur_x && cur_layer.y + cur_layer.height - 5 <= cur_y && cur_layer.y + cur_layer.height + 5 >= cur_y) {
                                    /// Is there a better way to return this info?
                                    document.title = "br";
                                    return "br";
                                } else if (cur_layer.x - 5 <= cur_x && cur_layer.x + 5 >= cur_x && cur_layer.y + cur_layer.height - 5 <= cur_y && cur_layer.y + cur_layer.height + 5 >= cur_y) {
                                    /// Is there a better way to return this info?
                                    document.title = "bl";
                                    return "bl";
                                }
                            /// If the decoration is a rotation circle
                            } else {
                            
                            }
                        } else {
                            if (is_inside_shape(cur_x, cur_y, [
                                {
                                    x: cur_layer.rotated_points.x1 - 5,
                                    y: cur_layer.rotated_points.y1 - 5
                                },
                                {
                                    x: cur_layer.rotated_points.x1 + 5,
                                    y: cur_layer.rotated_points.y1 - 5
                                },
                                {
                                    x: cur_layer.rotated_points.x1 + 5,
                                    y: cur_layer.rotated_points.y1 + 5
                                },
                                {
                                    x: cur_layer.rotated_points.x1 - 5,
                                    y: cur_layer.rotated_points.y1 + 5
                                }
                            ])) {
                                document.title = "ul";
                                return "ul";
                            }
                        }
                    }
                    document.title = "";
                    /// Start with the top layer.
                    i = layers.length - 1;
                    
                    ///TODO First determine if it is hovering over a decoration.
                    
                    /// Go through the layers backward (starting with the top).
                    while (i >= 0) {
                        cur_layer = layers[i];
                        ///TODO: If visible
                        /// If not rotated
                        if (cur_layer.angle === 0) {
                            if (cur_layer.x <= cur_x && cur_layer.x + cur_layer.width >= cur_x && cur_layer.y <= cur_y && cur_layer.y + cur_layer.height >= cur_y) {
                                break;
                            }
                        } else {
                            if (is_inside_shape(cur_x, cur_y, [
                                {
                                    x: cur_layer.rotated_points.x1,
                                    y: cur_layer.rotated_points.y1
                                },
                                {
                                    x: cur_layer.rotated_points.x2,
                                    y: cur_layer.rotated_points.y2
                                },
                                {
                                    x: cur_layer.rotated_points.x3,
                                    y: cur_layer.rotated_points.y3
                                },
                                {
                                    x: cur_layer.rotated_points.x4,
                                    y: cur_layer.rotated_points.y4
                                }
                            ])) {
                                break;
                            }
                        }
                        --i;
                    }
                    
                    return i;
                };
            }());
            
            canvas_el.onmousemove = function (e)
            {
                var cur_pos = get_relative_x_y(e),
                    cur_x,
                    cur_y,
                    tmp_layer,
                    x_move_amt,
                    y_move_amt;
                
                cur_x = cur_pos.x;
                cur_y = cur_pos.y;
                
                if (button_down) {
                    if (selected_layer >= 0) {
                        /// If moving
                        if (cur_action === action_move) {
                            cur_layer = layers[selected_layer];
                            
                            x_move_amt = cur_layer.x;
                            y_move_amt = cur_layer.y;
                            
                            cur_layer.x = layer_starting_x + (cur_x - mouse_starting_x);
                            cur_layer.y = layer_starting_y + (cur_y - mouse_starting_y);
                            
                            x_move_amt -= cur_layer.x;
                            y_move_amt -= cur_layer.y;
                            
                            cur_layer.rotated_points.x1 -= x_move_amt;
                            cur_layer.rotated_points.y1 -= y_move_amt;
                            cur_layer.rotated_points.x2 -= x_move_amt;
                            cur_layer.rotated_points.y2 -= y_move_amt;
                            cur_layer.rotated_points.x3 -= x_move_amt;
                            cur_layer.rotated_points.y3 -= y_move_amt;
                            cur_layer.rotated_points.x4 -= x_move_amt;
                            cur_layer.rotated_points.y4 -= y_move_amt;
                            /// Figure out a way to tell the canvas to only redraw the part that changed.
                            redraw();
                        }
                    }
                } else {
                    tmp_layer = get_layer_from_pos(cur_pos);
                    
                    /// Is the mouse hovering over a layer?
                    if (hover_layer !== tmp_layer) {
                        hover_layer = tmp_layer
                        //redraw();
                        if (hover_layer >= 0) {
                            canvas_el.style.cursor = "move";
                        } else {
                            canvas_el.style.cursor = "auto";
                        }
                    }
                }
            };
            
            canvas_el.onmousedown = function (e)
            {
                var cur_pos = get_relative_x_y(e);
                
                button_state = e.button;
                button_down  = true;
                
                /// Store the last layer so that it doesn't have to redraw the entire page.
                last_layer     = selected_layer;
                selected_layer = get_layer_from_pos(get_relative_x_y(e));
                
                if (last_layer != selected_layer) {
                    redraw();
                    
                    /// Last layer is no longer needed since it finished redrawing the parts that changed.
                    last_layer = -1;
                }
                
                if (selected_layer >= 0) {
                    ///TODO: This needs to be determined.
                    cur_action = action_move;
                    
                    canvas_el.style.cursor = "move";
                    
                    mouse_starting_x = cur_pos.x;
                    mouse_starting_y = cur_pos.y;
                    
                    layer_starting_x = layers[selected_layer].x;
                    layer_starting_y = layers[selected_layer].y;
                }
            };
            
            canvas_el.onmouseup = function (e)
            {
                button_state = e.button;
                button_down  = false;
            };
            
            /// Allow the cursor to leave the canvas and still affect the layer.
            document.onmousemove = function (e)
            {
                canvas_el.onmousemove(e);
            };
            
            /// Allow the cursor to leave the canvas and still affect the layer.
            document.onmouseup = function (e)
            {
                canvas_el.onmouseup(e);
            };
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
            //document.title = e.loaded / e.total;
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
            i     = 0,
            reader;
        
        e.stopPropagation();
        e.preventDefault();
        
        count = files.length;
        
        /// Only call the handler if one or more files were dropped.
        if (count < 1) {
            alert("ERROR: No files were dropped.");
            return;
        }
        
        function read_file()
        {
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
                canvas_manager.add_image(e2.target.result, cur_pos.x + (i * 15), cur_pos.y + (i * 15));
                ++i;
                
                if (i < count) {
                    read_file();
                }
            };
            
            /// Begin reading in files.
            reader.readAsDataURL(file);
        }
        
        read_file();
    }

    
    canvas_el.addEventListener("dragenter", ignore_event, false);
    canvas_el.addEventListener("dragexit",  ignore_event, false);
    canvas_el.addEventListener("dragover",  ignore_event, false);
    canvas_el.addEventListener("drop",      drop,         false);
    
}());