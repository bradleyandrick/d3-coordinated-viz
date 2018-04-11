
//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

    //pseudo-global variables
    var attrArray = ["Total Primary Production", "Total Primary Consumption", "Oil Products Production", "Oil Products Consumption", "Natural Gas Production", "Natural Gas Consumption", "Coal Production", "Coal Consumption", "Electricity Production", "Electricity Consumption"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute

     var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
    
   
    
     //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([463, 0])
        .domain([0, 3000]);
    
    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){

         //map frame dimensions
        var width = window.innerWidth * 0.5,
        height = 460;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on France
        var projection = d3.geoAlbers()
            .center([0, 46.2])
            .rotate([-2, 0, 0])
            .parallels([43, 62])
            .scale(2500)
            .translate([width / 2, height / 2]);

        var projection = d3.geoMollweide() 
        .rotate([0, 0, 0])
            .translate([width / 2, height / 2])
            .scale(150)
            ;

        var path = d3.geoPath()
            .projection(projection);



        //use queue to parallelize asynchronous data loading
        d3.queue()
            .defer(d3.csv, "data/CountryOnlyData.csv") //load attributes from csv
            .defer(d3.json, "data/CountriesAllSimplified.topojson") //load choropleth spatial data
            .await(callback);

        function callback(error, csvData, countries){
            
            //place graticule on the map
            setGraticule(map, path);

            var backgroundCountries = topojson.feature(countries, countries.objects.CountriesEnergyAllCode);

            var worldCountries = topojson.feature(countries, countries.objects.CountriesEnergyAllCode).features;
            
            var countriesAll = map.append("path")
                .datum(backgroundCountries)
                .attr("class", "countries")
                .attr("d", path);
            
            
            worldCountries = joinData(worldCountries, csvData);
            
            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumerationUnits(worldCountries, map, path, colorScale);


            setChart(csvData, colorScale);
            
            createDropdown(csvData);
            
            //console.log(csvData);
           // console.log(worldCountries);
        };
    };
    
    
    function setGraticule(map, path){
        var graticule = d3.geoGraticule()
                .step([20, 20]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines
    };

    function joinData(worldCountries, csvData){
        //loop through csv to assign each set of csv attribute values to geojson county
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
        
         var desc = countries.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
        
    };
    
    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#D4B9DA",
            "#C994C7",
            "#DF65B0",
            "#DD1C77",
            "#980043"
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
        //chart frame dimensions
       
        
        //Example 2.1 line 17...create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
        
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        


        //Example 2.4 line 8...set bars for each province
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
        
        var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
            
        
         //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 40)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(expressed + " in each Country");
        
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
            .text("Select Attribute");

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
            
        updateChart(bars, csvData.length, colorScale);
        
    };
    
    function updateChart(bars, n, colorScale){
        //position bars
        bars.attr("x", function(d, i){
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //size/resize bars
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });
        var chartTitle = d3.select(".chartTitle")
        .text( expressed + " in each country");
    };
    
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.i_code)
            .style("stroke", "blue")
            .style("stroke-width", "2");
        setLabel(props);
    };
    
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
    
    function setLabel(props){
        //label content
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed + "</b>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.i_code + "_label")
            .html(labelAttribute);

        var regionName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.name);
    };
    
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
    
    
})(); //last line of main.js