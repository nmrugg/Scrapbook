(function ()
{
    var canvas,
        canvas_el = document.getElementById("canvas");
    
    canvas = (function ()
    {
        var context = canvas_el.getContext("2d"),
            layers = [];
        
        canvas_el.style.background = "#FFF";
        
        /// Width and height must be set with setAttribute() to avoid stretching.
        canvas_el.setAttribute("width",  "800");
        canvas_el.setAttribute("height", "600");
        
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
                context.drawImage(cur_layer.img, cur_layer.x, cur_layer.y);
                
                context.restore();
                ++i;
            }
        }
        
        function create_new_layer(type, img, x, y, text)
        {
            return {
                composite: "source-over",
                img:       img,
                opacity:   1,
                text:      text,
                type:      type,
                x:         x,
                y:         y
            };
        }
    
        function add_image(dataURI, x, y)
        {
            var img = new Image();
            img.onload = function ()
            {
                /// Set original width/height
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
                
                canvas.add_image(e2.target.result, posX - canvas_el.offsetLeft, posY - canvas_el.offsetTop);
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