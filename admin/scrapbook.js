/*global window, FileReader */
/*jslint white: true, browser: true, devel: true, forin: true, onevar: true, undef: true, nomen: true, newcap: true, immed: true */

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
            cur_decoration,
            
            action_move   = 1,
            action_resize = 2,
            action_rotate = 3,
            action_crop   = 4,
            
            decoration_resize = 1,
            decoration_rotate = 2,
            decoration_crop   = 3,
            
            /// Functions
            draw_wrapped_text,
            get_text_dimensions,
            menu_manager,
            resize_layer,
            text_manager,
            toolbox_manager,
            
            /// Misc
            PI  = Math.PI,
            PI2 = PI * 2;
        
        cur_decoration = decoration_resize;
        
        canvas_el.style.background = "#FFF";
        
        /// Width and height must be set with setAttribute() to avoid stretching.
        canvas_el.setAttribute("width",  canvas.width);
        canvas_el.setAttribute("height", canvas.height);
        
        get_text_dimensions = (function ()
        {
            var test_el = document.createElement("div");
            
            test_el.style.display = "none";
            
            document.body.appendChild(test_el);
            
            return function (text, style, max_width)
            {
                var dim;
                /// Remove old text, in any.
                test_el.innerHTML = "";
                test_el.style.cssText = "display: none;" + style + "; position: absolute; padding: 0; margin: 0; border: 0; white-space: nowrap";
                
                if (max_width) {
                    test_el.style.maxWidth = max_width;
                }
                /// Convert spaces to non-breaking spaces to preserve whitespace.
                ///NOTE: \u00A0 is Unicode for the non-breaking space (&nbsp;).
                test_el.appendChild(document.createTextNode(text.replace(" ", "\u00A0")));
                test_el.style.display = "inline";
                
                dim = {
                    width:  test_el.offsetWidth,
                    height: test_el.offsetHeight
                };
                
                test_el.style.display = "none";
                
                return dim;
            };
        }());
        
        
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
                y2,
                
                cosine = Math.cos(angle),
                sine   = Math.sin(angle);
            
            center_x = x + (w / 2);
            center_y = y + (h / 2);
            
            /// Get points relative to the center of the rectangle.
            x1 = x - center_x;
            y1 = y - center_y;
            x2 = (x + w) - center_x;
            y2 = (y + h) - center_y;
            
            return {
                x1: Math.round(((cosine * x1 - sine   * y1) + center_x) * 100) / 100,
                y1: Math.round(((sine   * x1 + cosine * y1) + center_y) * 100) / 100,
                
                x2: Math.round(((cosine * x2 - sine   * y1) + center_x) * 100) / 100,
                y2: Math.round(((sine   * x2 + cosine * y1) + center_y) * 100) / 100,
                
                x3: Math.round(((cosine * x2 - sine   * y2) + center_x) * 100) / 100,
                y3: Math.round(((sine   * x2 + cosine * y2) + center_y) * 100) / 100,
            
                x4: Math.round(((cosine * x1 - sine   * y2) + center_x) * 100) / 100,
                y4: Math.round(((sine   * x1 + cosine * y2) + center_y) * 100) / 100
            };
        }

        
        function draw_decoration(cur_layer)
        {
            var corners,
                
                cur_x,
                cur_y,
                cur_x2,
                cur_y2;
            
            context.save();
            
            if (cur_decoration != decoration_rotate) {
                if (cur_layer.angle !== 0) {
                    
                    cur_layer.decoration_points = {
                        ///TODO: Figure out exactly where the points should be.
                        ul: rotate_rect(cur_layer.angle, cur_layer.corner_points.x1 - 4.5, cur_layer.corner_points.y1 - 4.5, 10, 10),
                        ur: rotate_rect(cur_layer.angle, cur_layer.corner_points.x2 - 6.5, cur_layer.corner_points.y2 - 4.5, 10, 10),
                        br: rotate_rect(cur_layer.angle, cur_layer.corner_points.x3 - 6.5, cur_layer.corner_points.y3 - 6.5, 10, 10),
                        bl: rotate_rect(cur_layer.angle, cur_layer.corner_points.x4 - 4.5, cur_layer.corner_points.y4 - 6.5, 10, 10)
                    };
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
                    };
                }
            }
            
            switch (cur_decoration) {
            case decoration_resize:
                
                for (corners in cur_layer.decoration_points) {
                    context.moveTo(cur_layer.decoration_points[corners].x1, cur_layer.decoration_points[corners].y1);
                    context.lineTo(cur_layer.decoration_points[corners].x2, cur_layer.decoration_points[corners].y2);
                    context.lineTo(cur_layer.decoration_points[corners].x3, cur_layer.decoration_points[corners].y3);
                    context.lineTo(cur_layer.decoration_points[corners].x4, cur_layer.decoration_points[corners].y4);
                    context.lineTo(cur_layer.decoration_points[corners].x1, cur_layer.decoration_points[corners].y1);
                }
                
                context.strokeStyle = "rgba(0, 0, 0, .5)";
                context.stroke();
                
                break;
            case decoration_rotate:
                context.strokeStyle = "rgba(0, 0, 255, .5)";
                
                context.arc(cur_layer.corner_points.x1, cur_layer.corner_points.y1, 5, 0, PI2, true);
                context.stroke();
                
                ///NOTE: beginPath() is needed to "pick up the pen" in between circles.
                context.beginPath();
                context.arc(cur_layer.corner_points.x2, cur_layer.corner_points.y2, 5, 0, PI2, true);
                context.stroke();
                
                context.beginPath();
                context.arc(cur_layer.corner_points.x3, cur_layer.corner_points.y3, 5, 0, PI2, true);
                context.stroke();
                
                context.beginPath();
                context.arc(cur_layer.corner_points.x4, cur_layer.corner_points.y4, 5, 0, PI2, true);
                context.stroke();
                break;
            case decoration_crop:
                break;
            }
            
            context.restore();
        }
        
        function create_smaller_img(cur_layer)
        {
            /// Prevent previous timeout, if any.
            window.clearTimeout(cur_layer.tmp_create_smaller_timeout);
            
            ///TODO: It would be good if there was a way to clear the timeout when the image is resized.
            cur_layer.tmp_create_smaller_timeout = window.setTimeout(function ()
            {
                var little_canvas = document.createElement("canvas"),
                    little_context,
                    little_img    = new Image();
                
                little_context = little_canvas.getContext("2d");
                
                little_canvas.setAttribute("width",  cur_layer.width);
                little_canvas.setAttribute("height", cur_layer.height);
                
                ///TODO: Since this can be very resource intensive, it would be nice if this could be done in a worker.
                ///TODO: Could also crop it.
                little_context.drawImage(cur_layer.img, 0, 0, cur_layer.width, cur_layer.height);
                
                little_img.onload = function ()
                {
                    cur_layer.img_small = little_img;
                    
                    cur_layer.smaller_w = cur_layer.width;
                    cur_layer.smaller_h = cur_layer.height;
                    
                    /// Make sure the canvas is out of the memory.
                    little_canvas = null;
                };
                
                little_img.src = little_canvas.toDataURL("image/png");
            }, 2000);
        }
        
        
        draw_wrapped_text = (function ()
        {
            function draw_line(cur_layer, text, starting_x, starting_y, style, max_width, dont_draw, line_height, original_y)
            {
                var cur_line      = "",
                    cur_word      = 0,
                    cur_y         = starting_y,
                    dimensions    = {height: line_height},
                    longest_width = 0,
                    min_width     = 0,
                    potenial_line = "",
                    text_arr      = text.split(/\s/),
                    text_arr_len,
                    tmp_width;
                
                text_arr_len = text_arr.length;
                
                function handle_drawing() {
                    if (!dont_draw && cur_line !== "") {
                        context.fillText(cur_line, starting_x, cur_y);
                        /// Cache lines so that we don't need to do this again until the text box or text has been changed.
                        cur_layer.text_lines[cur_layer.text_lines.length] = {text: cur_line, x: 0, y: cur_y - original_y};
                    }
                    
                    cur_y += dimensions.height;
                }
                
                while (cur_word < text_arr_len) {
                    /// Allow for double spaces.
                    ///BUG: This seems to insert two spaces.
                    if (text_arr[cur_word] === "") {
                        text_arr[cur_word] = " ";
                    }
                    potenial_line += (potenial_line !== "" ? " " : "") + text_arr[cur_word];
                    
                    if (!dimensions.height) {
                        ///NOTE: This needs to be called once to figure out the height of a line of text.
                        dimensions = get_text_dimensions(text_arr[0], style, max_width);
                    } else {
                        dimensions.width = context.measureText(potenial_line).width;
                    }
                    
                    if (cur_word === 0) {
                        min_width = dimensions.width;
                    }
                    
                    ///NOTE: cur_line !== "" prevents breaking before the first word.
                    if (dimensions.width > max_width && cur_line !== "") {
                        handle_drawing();
                        
                        cur_line = text_arr[cur_word];
                        potenial_line = cur_line;
                        
                        /// To figure out the minium width, measure the first word at the beginning of each line.
                        tmp_width = dimensions.width = context.measureText(text_arr[cur_word]).width;
                        if (tmp_width > min_width) {
                            min_width = tmp_width;
                        }
                    } else {
                        cur_line = potenial_line;
                        
                        if (dimensions.width > longest_width) {
                            longest_width = dimensions.width;
                        }
                    }
                    
                    ++cur_word;
                }
                
                ///NOTE: The last line has to be draw after the loop.
                handle_drawing();
                
                /// Send line height so that it can be sent back so that get_text_dimensions() does not have to run again because it is slow.
                return {height: cur_y - starting_y, width: longest_width, min_width: min_width, line_height: dimensions.height};
            }
            
            return function (cur_layer, text, starting_x, starting_y, style, max_width, dont_draw)
            {
                var cur_line = 0,
                    dimensions = {height: 0, line_height: null},
                    height = 0,
                    min_width     = 0,
                    longest_width = 0,
                    text_arr = text.split(/\n/),
                    text_arr_len;
                
                /// Is this a dry run?
                if (dont_draw) {
                    /// Dry runs always occur when the text has potentially been change, so we need to clear the cached lines.
                    cur_layer.text_lines = null;
                } else {
                    /// Have the lines already been cached?
                    if (cur_layer.text_lines) {
                        text_arr_len = cur_layer.text_lines.length;
                        
                        while (cur_line < text_arr_len) {
                            context.fillText(cur_layer.text_lines[cur_line].text, cur_layer.text_lines[cur_line].x + starting_x, cur_layer.text_lines[cur_line].y + starting_y);
                            ++cur_line;
                        }
                        
                        /// Since the lines were already cached, we can quite now.
                        return;
                    } else {
                        /// This is the first non-dry run, so create a fresh new array to store the cached lines.
                        cur_layer.text_lines = [];
                    }
                }
                
                text_arr_len = text_arr.length;
                
                while (cur_line < text_arr_len) {
                    dimensions = draw_line(cur_layer, text_arr[cur_line], starting_x, height + starting_y, style, max_width, dont_draw, dimensions.line_height, starting_y);
                    height += dimensions.height;
                    if (dimensions.width > longest_width) {
                        longest_width = dimensions.width;
                    }
                    if (dimensions.min_width > min_width) {
                        min_width = dimensions.min_width;
                    }
                    ++cur_line;
                }
                
                return {height: height, width: longest_width, min_width: min_width};
            };
        }());
        
        function redraw()
        {
            ///TODO: redraw() should take dimension or a layer as a parameter and only redraw that part.
            var cur_img,
                cur_layer,
                i = 0,
                layer_count = layers.length;
            
            ///TODO: Use last_layer to figure out what parts need to be redrawn.
            
            /// Redraw the entire canvas.
            canvas_el.setAttribute("width", canvas.width);
            
            while (i < layer_count) {
                /// If visible
                cur_layer = layers[i];
                
                context.save();
                
                /// If an image
                if (cur_layer.type == "img") {
                    /// Is there a smaller version and is it not too small?
                    if (cur_layer.img_small && cur_layer.width <= cur_layer.smaller_w && cur_layer.height <= cur_layer.smaller_h) {
                        cur_img = cur_layer.img_small;
                        
                        /// Should there be an even smaller image?
                        if (cur_layer.width < (cur_layer.smaller_w - 25) && cur_layer.height < (cur_layer.smaller_h - 25)) {
                            create_smaller_img(cur_layer);
                        }
                    } else {
                        cur_img = cur_layer.img;
                        
                        /// Should there be a smaller image?
                        if (cur_layer.width < (cur_layer.orig_w - 25) && cur_layer.height < (cur_layer.orig_h - 25)) {
                            create_smaller_img(cur_layer);
                        }
                    }
                    
                    context.globalAlpha              = cur_layer.opacity;
                    context.globalCompositeOperation = cur_layer.composite;
                    
                    /// If rotated
                    if (cur_layer.angle !== 0) {
                        context.translate(cur_layer.x + (cur_layer.width / 2), cur_layer.y + (cur_layer.height / 2));
                        context.rotate(cur_layer.angle);
                        context.drawImage(cur_img, 0 - (cur_layer.width / 2), 0 - (cur_layer.height / 2), cur_layer.width, cur_layer.height);
                    } else {
                        context.drawImage(cur_img, cur_layer.x, cur_layer.y, cur_layer.width, cur_layer.height);
                    }
                    
                /// Text
                } else {
                    /// Draw text starting from the upper left corner.
                    context.textBaseline = "top";
                    context.font = cur_layer.canvas_font;
                    context.fillStyle = cur_layer.font_color;
                    
                    if (cur_layer.angle !== 0) {
                        context.translate(cur_layer.x + (cur_layer.width / 2), cur_layer.y + (cur_layer.height / 2));
                        context.rotate(cur_layer.angle);
                        //context.fillText(cur_layer.text, 0 - (cur_layer.width / 2), 0 - (cur_layer.height / 2), cur_layer.width);
                        draw_wrapped_text(cur_layer, cur_layer.text, 0 - (cur_layer.width / 2), 0 - (cur_layer.height / 2), cur_layer.style_font, cur_layer.width);
                    } else {
                        //context.fillText(cur_layer.text, cur_layer.x, cur_layer.y, cur_layer.width);
                        draw_wrapped_text(cur_layer, cur_layer.text, cur_layer.x, cur_layer.y, cur_layer.style_font, cur_layer.width);
                    }
                }
                
                context.restore();
                
                ++i;
            }
            
            /// Is this the active layer?
            if (selected_layer >= 0) {
                draw_decoration(layers[selected_layer]);
            }
        }
        
        
        toolbox_manager = (function ()
        {
            var toolbox = document.createElement("menu");
            
            toolbox.style.display  = "none";
            toolbox.style.position = "fixed";
            toolbox.style.top      = "0px";
            toolbox.style.left     = "0px";
            
            toolbox.onmousedown = function (e)
            {
                /// Prevent the textarea from disappearing when the user clicks the toolbox.
                e.stopPropagation();
            }
            
            document.body.appendChild(toolbox);
            
            function create_input(name, value, onchange, extra)
            {
                var input_el = document.createElement("input");
                
                input_el.type = "text";
                input_el.value = value;
                input_el.onchange  = onchange;
                input_el.onkeyup   = onchange;
                input_el.onmouseup = onchange;
                
                toolbox.appendChild(document.createTextNode(name + ":"));
                toolbox.appendChild(document.createElement("br"));
                toolbox.appendChild(input_el);
                toolbox.appendChild(document.createElement("br"));
            }
            
            function show_font_changes(cur_layer)
            {
                cur_layer.canvas_font = cur_layer.font_size + " " + cur_layer.font_family;
                cur_layer.style_font  = "font-family:" + cur_layer.font_family + ";font-size:" + cur_layer.font_size + ";";
                
                text_manager.update_styles();
            }
            
            return {
                show: function (type, cur_layer)
                {
                    toolbox.innerHTML = "";
                    
                    if (type == "font") {
                        create_input("Font Family", cur_layer.font_family, function ()
                        {
                            cur_layer.font_family = this.value;
                            if (cur_layer.font_family.trim() === "") {
                                cur_layer.font_family = "sans";
                            }
                            show_font_changes(cur_layer);
                        });
                        
                        create_input("Font Size", cur_layer.font_size, function ()
                        {
                            cur_layer.font_size = this.value;
                            if (cur_layer.font_size == 0) {
                                cur_layer.font_size = 1;
                            }
                            show_font_changes(cur_layer);
                        });
                        
                        create_input("Font Color", cur_layer.font_color, function ()
                        {
                            cur_layer.font_color = this.value;
                            if (cur_layer.font_color.trim() === "") {
                                cur_layer.font_color = "#000000";
                            }
                            show_font_changes(cur_layer);
                        });
                    }
                    
                    toolbox.style.display = "block";
                },
                hide: function ()
                {
                    ///TODO: Use css transitions to fade.
                    toolbox.style.display = "none";
                }
            };
        }());
        
        text_manager = (function ()
        {
            var editing_layer,
                is_visible = false,
                text_el = document.createElement("textarea");
            
            text_el.style.display    = "none";
            text_el.style.outline    = "1px dashed rgba(0, 0, 0, .3)";
            text_el.style.padding    = "0";
            text_el.style.border     = "0";
            text_el.style.margin     = "0";
            text_el.style.position   = "absolute";
            text_el.style.background = "#FFF";
            
            text_el.onmousedown = function (e)
            {
                e.stopPropagation();
            };
            
            document.body.appendChild(text_el);
            
            return {
                edit_text: function (cur_layer)
                {
                    editing_layer = cur_layer;
                    
                    window.setTimeout(function ()
                    {
                        text_el.value = cur_layer.text;
                        text_el.style.left = ((cur_layer.x + canvas_el.offsetLeft) - 1) + "px";
                        text_el.style.top  = ((cur_layer.y + canvas_el.offsetTop)  - (parseInt(cur_layer.font_size, 10) * 0.15)) + "px";
                        
                        text_el.style.width  = cur_layer.width  + "px";
                        text_el.style.height = cur_layer.height + "px";
                        
                        text_el.style.fontFamily = cur_layer.font_family;
                        text_el.style.fontSize   = cur_layer.font_size;
                        text_el.style.color      = cur_layer.font_color;
                        
                        text_el.style.transform       = "rotate(" + cur_layer.angle + "rad)";
                        text_el.style.MozTransform    = "rotate(" + cur_layer.angle + "rad)";
                        text_el.style.OTransform      = "rotate(" + cur_layer.angle + "rad)";
                        text_el.style.WebkitTransform = "rotate(" + cur_layer.angle + "rad)";
                        text_el.style.MsTransform     = "rotate(" + cur_layer.angle + "rad)";
                        
                        text_el.onchange = function ()
                        {
                            cur_layer.text = text_el.value;
                        };
                        
                        text_el.onkeyup = text_el.onchange;
                        text_el.onblur  = text_el.onchange;
                        
                        text_el.style.display = "inline";
                        is_visible = true;
                        
                        text_el.focus();
                        
                        toolbox_manager.show("font", cur_layer);
                    }, 0);
                },
                hide_text: function ()
                {
                    if (is_visible) {
                        text_el.style.display  = "none";
                        is_visible = false;
                        
                        resize_layer(editing_layer, false, {x: editing_layer.corner_points.x3, y: editing_layer.corner_points.y3}, {x1: "x3", y1: "y3", x2: "x4", y2: "y4", x3: "x1", y3: "y1", x4: "x2", y4: "y2"});
                        
                        toolbox_manager.hide();
                        
                        window.setTimeout(redraw, 0);
                    }
                },
                update_styles: function ()
                {
                    text_el.style.fontFamily = editing_layer.font_family;
                    text_el.style.fontSize   = editing_layer.font_size;
                    text_el.style.color      = editing_layer.font_color;
                }
            };
        }());
        
        function create_new_layer(type, img, x, y, text)
        {
            var fit_into_height,
                fit_into_width,
                obj,
                shrink_by,
                temp_obj;
            
            obj = {
                angle:     0,
                composite: "source-over",
                opacity:   1,
                
                decoration_points: {},
                corner_points:     {},
                
                type: type,
                
                x: x,
                y: y
            };
            
            if (type == "img") {
                obj.img    = img;
                obj.orig_w = img.width;
                obj.orig_h = img.height;
                
                fit_into_width  = canvas.width  - (canvas.width  * 0.35);
                fit_into_height = canvas.height - (canvas.height * 0.35);
                
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
                
                obj.orig_aspect_ratio = obj.orig_w / obj.orig_h;
                obj.aspect_ratio      = obj.orig_aspect_ratio;
            } else {
                obj.font_family = "sans";
                obj.font_size   = "18px";
                obj.font_color  = "#000000";
                ///TODO: Add weight, italics, text-decoration, etc.
                //obj.weight = "normal";
                //obj.italics = "normal";
                obj.canvas_font = obj.font_size + " " + obj.font_family;
                obj.style_font  = "font-family:" + obj.font_family + ";font-size:" + obj.font_size + ";";
                
                obj.text = text;
                context.save();
                context.font = obj.canvas_font;
                
                
                temp_obj = get_text_dimensions(text, obj.style_font);
                obj.width  = temp_obj.width;
                obj.height = temp_obj.height;
                context.restore();
            }
            
            obj.corner_points = {
                x1: x,
                y1: y,
                
                x2: x + obj.width,
                y2: y,
                
                x3: x + obj.width,
                y3: y + obj.height,
                
                x4: x,
                y4: y + obj.height
            };
            
            return obj;
        }
                
        
        function rotate(cur_layer, angle)
        {
            cur_layer.angle = angle;
            
            cur_layer.corner_points = rotate_rect(angle, cur_layer.x, cur_layer.y, cur_layer.width, cur_layer.height);
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
                
                redraw();
            };
            img.src = dataURI;
        }
        
        function get_relative_x_y(e)
        {
            var posX = 0,
                posY = 0;
            
            if (typeof e.pageX != "undefined") {
                posX = e.pageX;
                posY = e.pageY;
            } else if (typeof e.clientX != "undefined") {
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
                
                layer_starting_angle,
                
                which_decoration,
                
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
                    
                    /// The area was always the same sign, so the point is inside the shape.
                    return true;
                }
                
                return function (cur_pos)
                {
                    var corners,
                        cur_layer,
                        cur_layer_corner,
                        cur_layer_dec,
                        cur_x = cur_pos.x,
                        cur_y = cur_pos.y,
                        i;
                    
                    /// First, check to see if the cursor is hovering over a decoration.
                    if (selected_layer >= 0) {
                        
                        ///NOTE: Move and Crop decorations are both squares.
                        if (cur_decoration != decoration_rotate) {
                            cur_layer_dec = layers[selected_layer].decoration_points;
                            for (corners in cur_layer_dec) {
                                if (is_inside_shape(cur_x, cur_y, [
                                    {
                                        x: cur_layer_dec[corners].x1,
                                        y: cur_layer_dec[corners].y1
                                    },
                                    {
                                        x: cur_layer_dec[corners].x2,
                                        y: cur_layer_dec[corners].y2
                                    },
                                    {
                                        x: cur_layer_dec[corners].x3,
                                        y: cur_layer_dec[corners].y3
                                    },
                                    {
                                        x: cur_layer_dec[corners].x4,
                                        y: cur_layer_dec[corners].y4
                                    }
                                ])) {
                                    return corners;
                                }
                            }
                        /// If the decoration is a rotation circle
                        } else {
                            cur_layer_corner = layers[selected_layer].corner_points;
                            if (Math.sqrt(Math.pow(cur_layer_corner.x1 - cur_x, 2) + Math.pow(cur_layer_corner.y1 - cur_y, 2)) <= 5) {
                                return "ul";
                            } else if (Math.sqrt(Math.pow(cur_layer_corner.x2 - cur_x, 2) + Math.pow(cur_layer_corner.y2 - cur_y, 2)) <= 5) {
                                return "ur";
                            } else if (Math.sqrt(Math.pow(cur_layer_corner.x3 - cur_x, 2) + Math.pow(cur_layer_corner.y3 - cur_y, 2)) <= 5) {
                                return "br";
                            } else if (Math.sqrt(Math.pow(cur_layer_corner.x4 - cur_x, 2) + Math.pow(cur_layer_corner.y4 - cur_y, 2)) <= 5) {
                                return "bl";
                            }
                        }
                    }
                    
                    /// Start with the top layer.
                    i = layers.length - 1;
                    
                    ///TODO First determine if it is hovering over a decoration.
                    
                    /// Go through the layers backward (starting with the top).
                    while (i >= 0) {
                        cur_layer = layers[i];
                        ///TODO: If visible
                        if (is_inside_shape(cur_x, cur_y, [
                            {
                                x: cur_layer.corner_points.x1,
                                y: cur_layer.corner_points.y1
                            },
                            {
                                x: cur_layer.corner_points.x2,
                                y: cur_layer.corner_points.y2
                            },
                            {
                                x: cur_layer.corner_points.x3,
                                y: cur_layer.corner_points.y3
                            },
                            {
                                x: cur_layer.corner_points.x4,
                                y: cur_layer.corner_points.y4
                            }
                        ])) {
                            break;
                        }
                        --i;
                    }
                    
                    return i;
                };
            }());
            
            
            function set_decoration_cursor(cur_layer, which_decoration)
            {
                var decoration_angle,
                    radian_45  = PI / 4,
                    radian_90  = PI / 2,
                    radian_135 = radian_45 + radian_90;
                
                decoration_angle = layers[selected_layer].angle + ((which_decoration == "ul") ? radian_45 : (which_decoration == "ur") ? radian_135 : (which_decoration == "br") ? -radian_135 : -radian_45);
                
                /// Prevent the angle from increasing/decreasing without end.
                if (decoration_angle > PI) {
                    decoration_angle = (decoration_angle % PI) - PI;
                } else if (decoration_angle < -PI) {
                    decoration_angle = (decoration_angle % PI) + PI;
                }
                
                ///NOTE: Could also use nesw-resize or nwse-resize cursors instead, but they may be less supported.
                if (decoration_angle >= 0 && decoration_angle < radian_90) {
                    canvas_el.style.cursor = "nw-resize";
                } else if (decoration_angle >= radian_90) {
                    canvas_el.style.cursor = "ne-resize";
                } else if (decoration_angle <= -radian_90) {
                    canvas_el.style.cursor = "se-resize";
                } else if (decoration_angle < 0 && decoration_angle > -radian_90) {
                    canvas_el.style.cursor = "sw-resize";
                }
            }
            
            
            resize_layer = (function ()
            {
                function get_opposite_points(angle, x1, y1, x3, y3)
                {
                    var cosine = Math.cos(-angle),
                        cos2,
                        sincos,
                        sine   = Math.sin(-angle),
                        sin2;
                    
                    cos2   = Math.pow(cosine, 2);
                    sin2   = Math.pow(sine,   2);
                    sincos = sine * cosine;
                    
                    return {
                        x2: x1 * sin2 + x3 * cos2 + (y1 - y3) * sincos,
                        y2: y3 * sin2 + y1 * cos2 + (x1 - x3) * sincos,
                        
                        x4: x3 * sin2 + x1 * cos2 + (y3 - y1) * sincos,
                        y4: y1 * sin2 + y3 * cos2 + (x3 - x1) * sincos
                    };
                }
                
                function find_x_y_before_rotation(angle, x1, y1, x3, y3)
                {
                    var center_x = (x1 + x3) / 2,
                        center_y = (y1 + y3) / 2,
                        x,
                        y,
                        
                        neg_cosine = Math.cos(-angle),
                        neg_sine   = Math.sin(-angle);
                    
                    /// Get points relative to the center of the rectangle.
                    x = x1 - center_x;
                    y = y1 - center_y;
                    
                    return {
                        x: Math.round(((neg_cosine * x - neg_sine   * y) + center_x) * 100) / 100,
                        y: Math.round(((neg_sine   * x + neg_cosine * y) + center_y) * 100) / 100
                    };
                }
                
                /**
                 * Check to see if the user is trying to resize the element too far to where it would be inverted and optionally check the aspect ratio.
                 */
                function check_dimensions(angle, new_pos, opposite_pos, should_x1_be_less, should_y1_be_less, keep_aspect_ratio, aspect_ratio, is_textbox, cur_layer)
                {
                    var center_x = (new_pos.x + opposite_pos.x) / 2,
                        center_y = (new_pos.y + opposite_pos.y) / 2,
                        
                        cosine = Math.cos(angle),
                        sine   = Math.sin(angle),
                        
                        neg_cosine = Math.cos(-angle),
                        neg_sine   = Math.sin(-angle),
                        
                        x1,
                        y1,
                        
                        x3,
                        y3,
                        
                        /// Get points relative to the center of the rectangle.
                        x1_rel = Math.round((new_pos.x - center_x) * 100) / 100,
                        y1_rel = Math.round((new_pos.y - center_y) * 100) / 100,
                        
                        x3_rel = Math.round((opposite_pos.x - center_x) * 100) / 100,
                        y3_rel = Math.round((opposite_pos.y - center_y) * 100) / 100,
                        
                        change_x = false,
                        change_y = false,
                        
                        min_dimensions;
                    
                    /// Unrotate the points.
                    x1 = Math.round((neg_cosine * x1_rel - neg_sine   * y1_rel) * 100) / 100;
                    y1 = Math.round((neg_sine   * x1_rel + neg_cosine * y1_rel) * 100) / 100;
                    
                    x3 = Math.round((neg_cosine * x3_rel - neg_sine   * y3_rel) * 100) / 100;
                    y3 = Math.round((neg_sine   * x3_rel + neg_cosine * y3_rel) * 100) / 100;
                    
                    
                    /// Check X
                    if (should_x1_be_less && x1 > x3) {
                        x1 = x3 - 1;
                        change_x = true;
                    } else if (!should_x1_be_less && x1 < x3) {
                        x1 = x3 + 1;
                        change_x = true;
                    }
                    
                    /// Check Y
                    if (should_y1_be_less && y1 > y3) {
                        y1 = y3 - 1;
                        change_y = true;
                    } else if (!should_y1_be_less && y1 < y3) {
                        y1 = y3 + 1;
                        change_y = true;
                    }
                    
                    if (is_textbox) {
                        context.save();
                        context.textBaseline = "top";
                        context.font = cur_layer.canvas_font;
                        context.fillStyle = cur_layer.font_color;
                        
                        min_dimensions = draw_wrapped_text(cur_layer, cur_layer.text, cur_layer.x, cur_layer.y, cur_layer.style_font, cur_layer.width, true);
                        context.restore();
                        
                        /// Check X
                        if (should_x1_be_less && x3 - x1 < min_dimensions.min_width) {
                            x1 = x3 - min_dimensions.min_width;
                            change_x = true;
                        } else if (!should_x1_be_less && x1 - x3 < min_dimensions.min_width) {
                            x1 = x3 + min_dimensions.min_width;
                            change_x = true;
                        }
                        
                        /// Check Y
                        if (should_y1_be_less && y3 - y1 < min_dimensions.height) {
                            y1 = y3 - min_dimensions.height;
                            change_y = true;
                        } else if (!should_y1_be_less && y1 - y3 < min_dimensions.height) {
                            y1 = y3 + min_dimensions.height;
                            change_y = true;
                        }
                    }
                    
                    if (keep_aspect_ratio) {
                        /// Is the width bigger?
                        if (aspect_ratio > 1) {
                            /// UL and BR
                            if (should_x1_be_less === should_y1_be_less) {
                                y1 = ((x1 - x3) / aspect_ratio) + y3;
                            /// UR and BL
                            } else {
                                y1 = ((x3 - x1) / aspect_ratio) + y3;
                            }
                            change_y = true;
                        } else {
                            /// UL and BR
                            if (should_x1_be_less === should_y1_be_less) {
                                x1 = ((y1 - y3) * aspect_ratio) + x3;
                            /// UR and BL
                            } else {
                                x1 = ((y3 - y1) * aspect_ratio) + x3;
                            }
                            change_x = true;
                        }
                    }
                                            
                    if (change_x || change_y) {
                        /// Rotate new points.
                        new_pos.x = Math.round(((cosine * x1 - sine   * y1) + center_x) * 100) / 100;
                        new_pos.y = Math.round(((sine   * x1 + cosine * y1) + center_y) * 100) / 100;
                    }
                }
                
                
                return function (cur_layer, keep_aspect_ratio, new_pos, points)
                {
                    var opposite_points,
                        unrotated_x_y;
                    
                    check_dimensions(cur_layer.angle, new_pos, {x: cur_layer.corner_points[points.x3], y: cur_layer.corner_points[points.y3]}, (points.x1 == "x1" || points.x1 == "x4"), (points.y1 == "y1" || points.y1 == "y2"), keep_aspect_ratio, cur_layer.aspect_ratio, cur_layer.type == "text", cur_layer);
                    
                    opposite_points = get_opposite_points(cur_layer.angle, new_pos.x, new_pos.y, cur_layer.corner_points[points.x3], cur_layer.corner_points[points.y3]);
                    
                    cur_layer.corner_points[points.x1] = new_pos.x;
                    cur_layer.corner_points[points.y1] = new_pos.y;
                    
                    cur_layer.corner_points[points.x2] = opposite_points.x2;
                    cur_layer.corner_points[points.y2] = opposite_points.y2;
                    
                    cur_layer.corner_points[points.x4] = opposite_points.x4;
                    cur_layer.corner_points[points.y4] = opposite_points.y4;
                    
                    unrotated_x_y = find_x_y_before_rotation(cur_layer.angle, cur_layer.corner_points.x1, cur_layer.corner_points.y1, cur_layer.corner_points.x3, cur_layer.corner_points.y3);
                    
                    cur_layer.x = unrotated_x_y.x;
                    cur_layer.y = unrotated_x_y.y;
                    
                    cur_layer.width  = Math.sqrt(Math.pow(cur_layer.corner_points.x2 - cur_layer.corner_points.x1, 2) + Math.pow(cur_layer.corner_points.y2 - cur_layer.corner_points.y1, 2));
                    cur_layer.height = Math.sqrt(Math.pow(cur_layer.corner_points.x4 - cur_layer.corner_points.x1, 2) + Math.pow(cur_layer.corner_points.y4 - cur_layer.corner_points.y1, 2));
                };
            }());
            
            canvas_el.onmousemove = (function ()
            {
                function calculate_angle(orig_angle, p_start, p_new, p_center, snap)
                {
                    var a,
                        b,
                        c,
                        
                        angle;
                    
                    /// Calculate lengths: sqrt((x1-x2)^2 + (y1-y2)^2)
                    a = Math.sqrt(Math.pow(p_start.x - p_center.x, 2) + Math.pow(p_start.y - p_center.y, 2));
                    b = Math.sqrt(Math.pow(p_start.x - p_new.x,    2) + Math.pow(p_start.y - p_new.y,    2));
                    c = Math.sqrt(Math.pow(p_new.x   - p_center.x, 2) + Math.pow(p_new.y   - p_center.y, 2));
                    
                    if (a === 0 || b === 0 || c === 0) {
                        return orig_angle;
                    }
                    
                    /// Calculate change in angle using the cosine law.
                    angle = Math.round(Math.acos((Math.pow(a, 2) + Math.pow(c, 2) - Math.pow(b, 2)) / (2 * a * c)) * 10000) / 10000;
                    
                    /// Need to figure out if rotating clockwise or counter.
                    /// We can figure this out by calculating the area of the triangle formed by these three points and seeing if it is positive (clockwise) or negative (counter clockwise).
                    ///NOTE: Adds in orig_angle too.
                    angle = (((p_start.x * p_new.y - p_start.y * p_new.x - p_center.x * p_new.y + p_center.y * p_new.x + p_center.x * p_start.y - p_center.y * p_start.x) > 0) ? angle : -angle) + orig_angle;
                    
                    /// Prevent the angle from increasing/decreasing without end.
                    if (angle > PI) {
                        angle = (angle % PI) - PI;
                    } else if (angle < -PI) {
                        angle = (angle % PI) + PI;
                    }
                    
                    if (snap) {
                        if (angle > -0.3927 && angle < 0.3927) {
                            angle = 0;         /// 0°
                        } else if (angle >= 0.3927 && angle < 1.178) {
                            angle = 0.785398;  /// 45°
                        } else if (angle >= 1.178 && angle < 1.9634) {
                            angle = 1.570796;  /// 90°
                        } else if (angle >= 1.9634 && angle < 2.7488) {
                            angle = 2.356194;  /// 135°
                        } else if ((angle >= 2.7488 && angle < 3.5342) || (angle <= -2.7488 && angle > -3.5342)) {
                            ///NOTE: 180° == -180°
                            angle = PI;        /// 180°
                        } else if (angle <= -0.3927 && angle > -1.178) {
                            angle = -0.785398; /// -45°
                        } else if (angle <= -1.178 && angle > -1.9634) {
                            angle = -1.570796; /// -90°
                        } else if (angle <= -1.9634 && angle > -2.7488) {
                            angle = -2.356194; /// -135°
                        }
                    }
                    
                    return angle;
                }
                
                return function (e)
                {
                    var cur_layer,
                        cur_pos = get_relative_x_y(e),
                        cur_x,
                        cur_y,
                        tmp_layer,
                        x_move_amt,
                        y_move_amt,
                        
                        keep_aspect_ratio,
                        shift_down = e.shiftKey;
                    
                    cur_x = cur_pos.x;
                    cur_y = cur_pos.y;
                    
                    if (button_down) {
                        if (selected_layer >= 0) {
                            
                            cur_layer = layers[selected_layer];
                            
                            if (cur_action === action_move) {
                                
                                x_move_amt = cur_layer.x;
                                y_move_amt = cur_layer.y;
                                
                                cur_layer.x = layer_starting_x + (cur_x - mouse_starting_x);
                                cur_layer.y = layer_starting_y + (cur_y - mouse_starting_y);
                                
                                x_move_amt -= cur_layer.x;
                                y_move_amt -= cur_layer.y;
                                
                                cur_layer.corner_points.x1 -= x_move_amt;
                                cur_layer.corner_points.y1 -= y_move_amt;
                                cur_layer.corner_points.x2 -= x_move_amt;
                                cur_layer.corner_points.y2 -= y_move_amt;
                                cur_layer.corner_points.x3 -= x_move_amt;
                                cur_layer.corner_points.y3 -= y_move_amt;
                                cur_layer.corner_points.x4 -= x_move_amt;
                                cur_layer.corner_points.y4 -= y_move_amt;
                            } else if (cur_action === action_resize) {
                                keep_aspect_ratio = !shift_down && cur_layer.type == "img";
                                
                                /// Resize
                                if (which_decoration == "ul") {
                                    resize_layer(cur_layer, keep_aspect_ratio, {x: cur_x, y: cur_y}, {x1: "x1", y1: "y1", x2: "x2", y2: "y2", x3: "x3", y3: "y3", x4: "x4", y4: "y4"});
                                } else if (which_decoration == "ur") {
                                    resize_layer(cur_layer, keep_aspect_ratio, {x: cur_x, y: cur_y}, {x1: "x2", y1: "y2", x2: "x1", y2: "y1", x3: "x4", y3: "y4", x4: "x3", y4: "y3"});
                                } else if (which_decoration == "br") {
                                    resize_layer(cur_layer, keep_aspect_ratio, {x: cur_x, y: cur_y}, {x1: "x3", y1: "y3", x2: "x4", y2: "y4", x3: "x1", y3: "y1", x4: "x2", y4: "y2"});
                                } else if (which_decoration == "bl") {
                                    resize_layer(cur_layer, keep_aspect_ratio, {x: cur_x, y: cur_y}, {x1: "x4", y1: "y4", x2: "x3", y2: "y3", x3: "x2", y3: "y2", x4: "x1", y4: "y1"});
                                }
                                
                                /// Since there is a small amount of rounding, it is best not to recalculate the aspect ratio if the aspect ratio is supposed to be kept.
                                if (!keep_aspect_ratio && cur_layer.type == "img") {
                                    cur_layer.aspect_ratio = cur_layer.width / cur_layer.height;
                                }
                            } else if (cur_action === action_rotate) {
                                rotate(cur_layer, calculate_angle(layer_starting_angle, {x: mouse_starting_x, y: mouse_starting_y}, {x: cur_x, y: cur_y}, {x: (cur_layer.corner_points.x1 + cur_layer.corner_points.x3) / 2, y: (cur_layer.corner_points.y1 + cur_layer.corner_points.y3) / 2}, shift_down));
                            }
                            
                            /// Figure out a way to tell the canvas to only redraw the part that changed.
                            redraw();
                        }
                    } else {
                        tmp_layer = get_layer_from_pos(cur_pos);
                        
                        /// Is the mouse over a decoration?  (If get_layer_from_pos returns a string, it is a deocration.)
                        if (typeof tmp_layer == "string") {
                            hover_layer = tmp_layer;
                            /// Resize and Crop can use the same cursor
                            if (cur_decoration != decoration_rotate) {
                                set_decoration_cursor(layers[selected_layer], tmp_layer);
                            } else {
                                ///TODO: Make a rotate cursor image.
                                canvas_el.style.cursor = "crosshair";
                            }
                            
                        /// Is the cursor hovering over something different than before?
                        } else if (hover_layer !== tmp_layer) {
                            hover_layer = tmp_layer;
                            
                            /// Is the mouse hovering over a layer?
                            if (hover_layer >= 0) {
                                canvas_el.style.cursor = "move";
                            } else {
                                canvas_el.style.cursor = "auto";
                            }
                        
                        }
                    }
                };
            }());
            
            canvas_el.onmousedown = function (e)
            {
                var cur_layer,
                    cur_pos = get_relative_x_y(e),
                    tmp_layer;
                
                button_state = e.button;
                button_down  = true;
                
                /// Store the last layer so that it doesn't have to redraw the entire page.
                last_layer = selected_layer;
                tmp_layer  = get_layer_from_pos(cur_pos);
                
                if (typeof tmp_layer == "string") {
                    if (cur_decoration === decoration_resize) {
                        cur_action = action_resize;
                    } else if (cur_decoration == decoration_rotate) {
                        cur_action = action_rotate;
                    } else if (cur_decoration == decoration_crop) {
                        cur_action = action_crop;
                    }
                    
                    if (cur_decoration != decoration_rotate) {
                        set_decoration_cursor(layers[selected_layer], tmp_layer);
                    } else {
                        /// Make a rotate cursor image.
                        layer_starting_angle = layers[selected_layer].angle;
                    }
                    
                    mouse_starting_x = cur_pos.x;
                    mouse_starting_y = cur_pos.y;
                    
                    which_decoration = tmp_layer;
                    
                } else {
                    ///NOTE: If no layer was selected, tmp_layer will be -1.
                    selected_layer = tmp_layer;
                    
                    if (tmp_layer >= 0) {
                        cur_layer = layers[selected_layer];
                        
                        cur_action = action_move;
                        
                        canvas_el.style.cursor = "move";
                        
                        mouse_starting_x = cur_pos.x;
                        mouse_starting_y = cur_pos.y;
                        
                        layer_starting_x = cur_layer.x;
                        layer_starting_y = cur_layer.y;
                    }
                }
                
                if (last_layer !== selected_layer) {
                    redraw();
                    
                    /// Last layer is no longer needed since it finished redrawing the parts that changed.
                    last_layer = -1;
                }
            };
            
            
            function switch_decoration()
            {
                switch (cur_decoration) {
                case decoration_resize:
                    cur_decoration = decoration_rotate;
                    break;
                case decoration_rotate:
                    ///FIXME: Temporarily skipping crop until I have the time to write it.
                    //cur_decoration = decoration_crop;
                    cur_decoration = decoration_resize;
                    break;
                case decoration_crop:
                    cur_decoration = decoration_resize;
                    break;
                }
            }
            
            canvas_el.ondblclick = function (e)
            {
                /// Since onmousedown already fired, the layer is selected already.
                if (selected_layer >= 0) {
                    if (layers[selected_layer].type == "text") {
                        text_manager.edit_text(layers[selected_layer]);
                    } else {
                        switch_decoration();
                    }
                    redraw();
                }
            };
            
            canvas_el.onmouseup = function (e)
            {
                button_state = e.button;
                button_down  = false;
            };
            
            
            menu_manager = (function ()
            {
                var hide_menu_timeout,
                    menu_el = document.createElement("menu");
                
                menu_el.style.display = "none";
                
                document.body.insertBefore(menu_el, null);
                
                function add_menu_item(text, click_func)
                {
                    var el;
                    
                    el = document.createElement("div");
                    el.innerHTML = text;
                    el.onmousedown = click_func;
                    menu_el.insertBefore(el, null);
                }
                
                
                function rearrange_layer(which_layer, new_pos, downward)
                {
                    var layers_len = layers.length,
                        new_layers = [],
                        
                        new_count = 0,
                        old_count = 0;
                    
                    if (new_pos >= 0 && new_pos < layers_len) {
                        while (old_count < layers_len) {
                            if (downward && old_count === new_pos) {
                                new_layers[new_count] = layers[which_layer];
                                if (which_layer === selected_layer) {
                                    selected_layer = new_count;
                                }
                                ++new_count;
                            }
                            
                            if (old_count !== which_layer) {
                                new_layers[new_count] = layers[old_count];
                                if (which_layer === selected_layer) {
                                    selected_layer = new_count;
                                }
                                ++new_count;
                            }
                            
                            if (!downward && old_count === new_pos) {
                                new_layers[new_count] = layers[which_layer];
                                if (which_layer === selected_layer) {
                                    selected_layer = new_count;
                                }
                                ++new_count;
                            }
                            
                            ++old_count;
                        }
                        
                        layers = new_layers;
                    }
                }
                
                return {
                    display_menu: function (pos, layer)
                    {
                        var cur_layer;
                        
                        /// Clear old menu.
                        menu_el.innerHTML = "";
                        
                        clearTimeout(hide_menu_timeout);
                        
                        if (layer >= 0) {
                            cur_layer = layers[layer];
                            
                            if (cur_layer.type == "text") {
                                add_menu_item("Edit Text", function ()
                                {
                                    text_manager.edit_text(cur_layer);
                                });
                            }
                            
                            add_menu_item("Change Tool", function ()
                            {
                                switch_decoration();
                                redraw();
                            });
                            
                            if (layer > 0) {
                                add_menu_item("Send Backward", function ()
                                {
                                    rearrange_layer(layer, layer - 1, true);
                                    redraw();
                                });
                                
                                add_menu_item("Send to Back", function ()
                                {
                                    rearrange_layer(layer, 0, true);
                                    redraw();
                                });
                            }
                            
                            if (layer < layers.length - 1) {
                                add_menu_item("Bring Forward", function ()
                                {
                                    rearrange_layer(layer, layer + 1, false);
                                    redraw();
                                });
                                
                                add_menu_item("Brint to Front", function ()
                                {
                                    rearrange_layer(layer, layers.length - 1, false);
                                    redraw();
                                });
                            }
                            
                            if (cur_layer.aspect_ratio != cur_layer.orig_aspect_ratio) {
                                add_menu_item("Reset Aspect Ratio", function ()
                                {
                                    cur_layer.width = cur_layer.height * cur_layer.orig_aspect_ratio;
                                    cur_layer.aspect_ratio = cur_layer.orig_aspect_ratio;
                                    cur_layer.corner_points = rotate_rect(cur_layer.angle, cur_layer.x, cur_layer.y, cur_layer.width, cur_layer.height);
                                    ///FIXME: The layer's X and Y values change, but they really shouldn't.
                                    redraw();
                                });
                            }
                            
                            add_menu_item("Delete", function ()
                            {
                                var layers_len = layers.length,
                                    new_layers = [],
                                    
                                    new_count = 0,
                                    old_count = 0;
                                
                                while (old_count < layers_len) {
                                    if (old_count !== layer) {
                                        new_layers[new_count] = layers[old_count];
                                        ++new_count;
                                    }
                                    ++old_count;
                                }
                                
                                layers = new_layers;
                                
                                if (selected_layer === layer) {
                                    selected_layer = -1;
                                }
                                
                                redraw();
                            });
                        } else {
                            add_menu_item("Add Text", function ()
                            {
                                var new_layer = create_new_layer("text", null, pos.x, pos.y, "Enter Text Here");
                                layers[layers.length] = new_layer;
                                /// Redraw the page to get rid of the initial text and to show something there immediately after the textbox disappears.
                                redraw();
                                text_manager.edit_text(new_layer);
                            });
                        }
                        
                        if (layers.length > 0) {
                            add_menu_item("View Image", function ()
                            {
                                var tmp_selected = selected_layer;
                                
                                /// Hide the decorations.
                                if (tmp_selected != -1) {
                                    selected_layer = -1;
                                    redraw();
                                }
                                
                                /// Create the image in a new tab.
                                window.open(canvas_el.toDataURL("image/png"));
                                
                                /// Reselect the layer.
                                if (tmp_selected != -1) {
                                    selected_layer = tmp_selected;
                                    redraw();
                                }
                            });
                        }
                        
                        
                        menu_el.style.cssText = "display: block; position: absolute; left: " + (pos.x + canvas_el.offsetLeft) + "px; top: " + (pos.y + canvas_el.offsetTop) + "px;";
                    },
                    hide_menu: function ()
                    {
                        hide_menu_timeout = window.setTimeout(function ()
                        {
                            menu_el.style.display = "none";
                        }, 100);
                    }
                };
            }());
            
            canvas_el.addEventListener("contextmenu", function (e)
            {
                /// Prevent menu from displaying.
                e.stopPropagation();
                e.preventDefault();
                
                menu_manager.display_menu(get_relative_x_y(e), selected_layer);
                
                return false;
            }, true);
            
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
            
            ///NOTE: This is prevented by toolbox.onmousedown() when clicking on the toolbox.
            document.onmousedown = function (e)
            {
                /// This will hide the context menu even if the user clicked off of the canvas.
                menu_manager.hide_menu();
                
                text_manager.hide_text();
            };
        }());
        
        
        /// Display initial explaination.
        (function ()
        {
            var dimensions1,
                dimensions2,
                font_size1 = "50",
                font_size2 = "20",
                text1 = "Drop Images Here",
                text2 = "(right click to add text or get more options)";
            
            context.save();
            context.textBaseline = "top";
            context.font = font_size1 + "px sans";
            context.fillStyle = "#000000";
            dimensions1 = get_text_dimensions(text1, "font-family: sans;font-size: " + font_size1 + "px;")
            context.fillText(text1, (canvas.width / 2) - (dimensions1.width / 2), (canvas.height / 2) - dimensions1.height);
            context.restore();
            
            context.save();
            context.textBaseline = "top";
            context.font = font_size2 + "px sans";
            context.fillStyle = "#000000";
            dimensions2 = get_text_dimensions(text2, "font-family: sans;font-size: " + font_size2 + "px;")
            context.fillText(text2, (canvas.width / 2) - (dimensions2.width / 2), ((canvas.height / 2) - dimensions2.height) + (dimensions1.height / 2));
            context.restore();
        }());
        
        return {
            add_image:        add_image,
            get_relative_x_y: get_relative_x_y
        };
    }(canvas_el));
    
    
    function handleReadernotification(e)
    {
        if (e.lengthComputable) {
            document.title = "Scrapbook (" + (e.loaded / e.total) + ")";
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
                document.title = "Scrapbook";
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