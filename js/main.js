
//self-executing anonymous function
(function(){

    // set up global level variables
    
    // set up array to use for legend and retreiving data values
    var attrArray = ["Total Primary Production (Mtoe)", "Total Primary Consumption (Mtoe)", "Oil Products Production (Mt)", "Oil Products Consumption (Mt)", "Natural Gas Production (bcm)", "Natural Gas Consumption (bcm)", "Coal Production (Mt)", "Coal Consumption (Mt)", "Electricity Production (TWh)", "Electricity Consumption (TWh)"];
    
    // set default attribute
    var expressed = attrArray[0]; 
    
    // get the height of the client to set the inital chart height 
    var getHeight = document.documentElement.clientHeight -20;
    var getHeightRange = getHeight - 10;

    // default chart settings
     var chartWidth = window.innerWidth * 0.47,
        chartHeight = getHeight,
        leftPadding = 45,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
    
    //create a scale to set bar height
    var yScale = d3.scaleLinear()
        .range([getHeightRange, 0])
        .domain([0, 2538]);
    
    //begin script when window loads
    window.onload = setMap();

    //function to set up the map
    function setMap(){

        //map frame dimensions
        var width = window.innerWidth * 0.5,
        height = 460;
        
        // set the height and width of the info div
        document.getElementById("info").style.width = window.innerWidth * 0.48 + "px";
        document.getElementById("info").style.height = window.innerHeight - 490 + "px";

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        // set up the geoMollweide projection for showing the entire globe at once
        var projection = d3.geoMollweide() 
        .rotate([0, 0, 0])
            .translate([width / 2, height / 2])
            .scale(150);

        var path = d3.geoPath()
            .projection(projection);

        //use queue to asynchronously load the data
        d3.queue()
            .defer(d3.csv, "data/CountryOnlyData.csv") //csv
            .defer(d3.json, "data/CountriesAllSimplified.topojson") //data for baselayer with all countries
            .defer(d3.json, "data/CountiresEnergy44Code.topojson") // data for spatial countries of interest
            .await(callback);
        
        // function to call after the data has been loaded
        function callback(error, csvData, backgroundCountries, countries){
            
            //place graticule on the map
            setGraticule(map, path);

            // get the reference background Countries layer
            var backgroundCountries = topojson.feature(backgroundCountries, backgroundCountries.objects.CountriesEnergyAllCode);

            // get the world countries to tie to csv data
            var worldCountries = topojson.feature(countries, countries.objects.CountiresEnergy44Code).features;
            
            // add the background Countries to the map
            var countriesAll = map.append("path")
                .datum(backgroundCountries)
                .attr("class", "countries")
                .attr("d", path);
            
            // combine the spatial data and tabular data
            worldCountries = joinData(worldCountries, csvData);
            
            // set the initial color scale
            var colorScale = makeColorScale(csvData);

            //call function to add enumeration units to the map
            setEnumerationUnits(worldCountries, map, path, colorScale);

            // call function to add data to the chart
            setChart(csvData, colorScale);
            
            // call function to setup the dropdown list
            createDropdown(csvData);

        };
    };
    
    //function to set up graticule for map
    function setGraticule(map, path){
        var graticule = d3.geoGraticule()
                .step([20, 20]); //place graticule lines every 20 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) 
            .attr("class", "gratBackground") 
            .attr("d", path) 

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") 
            .data(graticule.lines()) 
            .enter() 
            .append("path") 
            .attr("class", "gratLines") 
            .attr("d", path); 
    };

    // function to join data from spatial data and tabular data
    function joinData(worldCountries, csvData){
        //loop through csv and combine on all values
        for (var i = 0; i<csvData.length; i++){
            var csvCountry = csvData[i];
            var csvKey = csvCountry.i_code;

            for (var a = 0; a< worldCountries.length; a++){
                var geojsonProps = worldCountries[a].properties;
                var geojsonKey = geojsonProps.i_code;

                if (geojsonKey == csvKey){
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvCountry[attr]);
                        geojsonProps[attr] = val;
                    });
                };
            };
        };
        return worldCountries;
    };
    
    // function to enumorate through countries and handle country style and events
    function setEnumerationUnits(worldCountries, map, path, colorScale){
        var countries = map.selectAll(".country")
            .data(worldCountries)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "country " + d.properties.i_code;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            })
            .on("mouseover", function(d){
                highlight(d.properties);
            })
            .on("mouseout", function(d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);
        
        // set desc to reset blank borders
        var desc = countries.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');
        
    };
    
    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#ffffcc",
            "#c2e699",
            "#78c679",
            "#31a354",
            "#006837"
        ];

        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;
    };
    
    //function to test for data value and return color
    function choropleth(props, colorScale){
        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#e0e0e0";
        };
    };
    
    //function to create coordinated bar chart
    function setChart(csvData, colorScale){

        //create svg element to hold chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
        //add rectangle for background
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        
        //setup bars based on country info
        var bars = chart.selectAll(".bars")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.i_code;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);
        
        // set desc to reset bar select after mouseout
        var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
            
        
         //create chart title
        var chartTitle = chart.append("text")
            .attr("x", chartWidth - 490)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(expressed);
        
        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        
        // call function to update the chart
        updateChart(bars, csvData.length, colorScale);
        
        
    };
    
    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Metric");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };
    
    //dropdown change listener handler
    function changeAttribute(attribute, csvData){
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var countries = d3.selectAll(".country")
            .transition()
            .duration(1000)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });
        //reset max value for chart
         var max = d3.max(csvData, function(d){
            return + parseFloat(d[expressed])
        });
        
        //set reset yScale
        yScale = d3.scaleLinear()
            .range([chartHeight-10, 0])
            .domain([0, max]);
        
        //re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bar")
            //re-sort bars
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function(d, i){
                return i * 20
            })
            .duration(500);
            
        // call function to update the chart
        updateChart(bars, csvData.length, colorScale);
        
    };
    
    // function that updates the chart graphic and info
    function updateChart(bars, n, colorScale){
        //position bars
        bars.attr("x", function(d, i){
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //resize bars
            .attr("height", function(d){
                var outHeight = (chartHeight-9) -  yScale(d[expressed]);
                if (outHeight < 0) {
                    return 0;
                } else {
                    return outHeight;
                }})
            .attr("y", function(d) {
                var outY = yScale(d[expressed]) +5;
                if (outY < 0) {
                    return 0;
                } else {
                    return outY;
                }})          
            //recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });
        //set new chart title
        var chartTitle = d3.select(".chartTitle")
        .text( expressed);
        
        //update the chart axis
        var yAxis = d3.axisLeft()
            .scale(yScale);
        
        d3.selectAll("g.axis")
        .call(yAxis);
    };
    
    //function to hand highlighting of the data
    function highlight(props){
            var selected = d3.selectAll("." + props.i_code)
                .style("stroke", "#ff6166")
                .style("stroke-width", "2");
        //call function to set the label that shows on hover    
        setLabel(props);  
    };
    
    //function to drop highlight and reset the graphics
    function dehighlight(props){
        var selected = d3.selectAll("." + props.i_code)
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };
        d3.select(".infolabel")
        .remove();
    };
    
    // function to set the label that is used on hover to identify attribute and feature
    function setLabel(props){
       // add a label for content 
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed + "</b>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.i_code + "_label")
            .html(labelAttribute);

        var countryName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.NAME);
    };
    
    // function to locate the label as the user moves the map
    function moveLabel(){
       var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1; 

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };
       
})();