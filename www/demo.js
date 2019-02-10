var fruits = ['apple', 'mango', 'banana', 'orange'];
    d3.select('ul')
        .selectAll('li')
        .data(fruits)
        .enter()
        .append('li')
        .text(function(d) { return d; });