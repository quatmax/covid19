class File {
    constructor( filename ) {
        this.filename = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_" + file + "_global.csv";
    }
    visitFile(visitor) {
        var dataFile = new XMLHttpRequest();
        dataFile.open("GET", filename, true);
        dataFile.onreadystatechange = function () {
            if (dataFile.readyState === 4) {
                if (dataFile.status === 200 || dataFile.status == 0) {
                    visitor(dataFile.responseText.split(/\r\n|\n/));
                }
            }
        };
        dataFile.send();
    }
    visitLineData(visitLine) {
        visitFile(function(allTextLines){
            for (index = 1; index < allTextLines.length; index++) {
                var line = allTextLines[index];
                visitLine(line.split(/,/));
            }
        });
    }
    visitLabels(visitLabels) {
        visitFile(function (allTextLines) {
            visitLabels(allTextLines[0].split(/,/).slice(4));
        });
    }
};

class Country {
    constructor() {
        this.confirmed = [];
        this.recovered = [];
        this.deaths = [];
    }
    currentConfirmed() {
        if (this.confirmed.length > 0) {
            return -1;
        }
        return this.confirmed[this.confirmed.length - 1];
    }
    addInts(lineData, member) {
        var ints = lineData.slice(4).map(function (item) { return parseInt(item, 10); });
        member.length = ints.length;
        member = member.map(function (v, i) { return v + ints[i]; });
    }
    addConfirmed(lineData) { addInts(lineData, this.confirmed); }
    addRecovered(lineData) { addInts(lineData, this.recovered); }
    addDeaths(lineData) { addInts(lineData, this.deaths); }
    average4DayGrowth() {
        return -1;
    }
};
class Countries {
    constructor() {
        this.countries = new Map();
        this.labels = [];
    }
    static load() {
        var cs = new Countries();
        new File('confirmed').visitLabels(function(labelsData){ this.labels = labelsData; });
        new File('confirmed').visitLine(function(lineData) {
            var country = cs.countries.get(line[1]);
            if(country == undefined) {
                country = new Country();
            }
            country.addConfirmed(lineData);
        });
        new File('recovered').visitLine(function(lineData) {
            var country = cs.countries.get(line[1]);
            if(country == undefined) {
                country = new Country();
            }
            country.addRecovered(lineData);
        });
        new File('deaths').visitLine(function(lineData) {
            var country = cs.countries.get(line[1]);
            if(country == undefined) {
                country = new Country();
            }
            country.addDeaths(lineData);
        });
    }
};
function addDataSet(chart, label_, color, province, country) {
    visitFile(label_, function (allText) {
        var allTextLines = allText.split(/\r\n|\n/);
        var countryData = [];
        var datesLabels = allTextLines[0].split(/,/).slice(4);
        for (index = 1; index < allTextLines.length; index++) {
            var line = allTextLines[index];
            var lineData = line.split(/,/);
            if (lineData[0] == province && lineData[1] == country) {
                countryData = lineData.slice(4).map(function (item) { return parseInt(item, 10); });
                break;
            }
        }
        chart.data.labels = datesLabels;
        chart.data.datasets.push({ label: label_, fill: false, borderColor: color, data: countryData });
        chart.update();
    });
}
function addChart(chart, province, country) {
    chart.data.labels = [];
    chart.data.datasets = [];
    addDataSet(chart, 'confirmed', 'rgb(255, 99, 132)', province, country);
    addDataSet(chart, 'recovered', 'rgb(0, 204, 102)', province, country);
    addDataSet(chart, 'deaths', 'rgb(0, 0, 0)', province, country);
}
function fillSelect(country) {
    visitFile('confirmed', function (allText) {
        var allTextLines = allText.split(/\r\n|\n/);
        for (index = 1; index < allTextLines.length; index++) {
            var line = allTextLines[index];
            var lineParts = line.split(/,/);
            data = lineParts.slice(0, 2);
            label = data[1];
            if (data[0].length > 0) {
                label += " (" + data[0] + ")";
            }
            label += ' confirmed cases ' + lineParts[lineParts.length - 1];
            var select = document.getElementById('selectCountry');
            var opt = document.createElement('option');
            opt.value = index - 1;
            opt.innerHTML = label;
            opt.id = data[0] + '#' + data[1];
            select.appendChild(opt);
            if (data[1] == country) {
                select.selectedIndex = index - 1;
                opt.select = true;
            }
        }
    });
}
function dashboard() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const key = 'country';
    var country = 'Austria';
    if (urlParams.has(key)) {
        country = urlParams.get(key);
    }
    var ctx = document.getElementById('theChart').getContext('2d');
    var chart = new Chart(ctx, { type: 'line', options: {} });
    fillSelect(country);
    addChart(chart, '', country);
    var select = document.getElementById('selectCountry');
    select.onchange = function () {
        var option = select.options[select.selectedIndex];
        var splitted = option.id.split('#');
        addChart(chart, splitted[0], splitted[1]);
    };
}