(function ()
{
    var canvas_manager,
        canvas_el = document.getElementById("canvas");
    
    canvas_manager = (function ()
    {
        var canvas = {
            height: 600,
            width:  800
        },
            context = canvas_el.getContext("2d"),
            layers = [];
        
        canvas_el.style.background = "#FFF";
        
        /// Width and height must be set with setAttribute() to avoid stretching.
        canvas_el.setAttribute("width",  canvas.width);
        canvas_el.setAttribute("height", canvas.height);
        
        function redraw()
        {
            var cur_layer,
                i = 0,
                layer_count = layers.length;
            
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
        }
        
        function create_new_layer(type, img, x, y, text)
        {
            var obj,
                shrink_by;
            
            obj = {
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
        
        return {
            add_image: add_image
        };
    }());
    
    
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
                var posX = 0,
                    posY = 0;
                
                if (e.pageX || e.pageY) {
                    posX = e.pageX;
                    posY = e.pageY;
                } else if (e.clientX || e.clientY) {
                    posX = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
                    posY = e.clientY + document.body.scrollTop  + document.documentElement.scrollTop;
                }
                
                /// offset_count moves the images over slightly when dropping more than one at a time in order to see them all  .
                canvas_manager.add_image(e2.target.result, (posX - canvas_el.offsetLeft) + (offset_count * 15), (posY - canvas_el.offsetTop) + (offset_count * 15));
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