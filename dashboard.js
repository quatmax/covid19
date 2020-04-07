
function getFileName(file) {
    return "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_" + file + "_global.csv";
}

function visitFile(file, visitor) {
    var filename = getFileName(file);
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
function visitLineData(file, visitLine, onFinished) {
    visitFile(file, function (allTextLines) {
        for (var index = 1; index < allTextLines.length; index++) {
            var line = allTextLines[index];
            visitLine(line.split(/,/));
        }
        if (onFinished != undefined) {
            onFinished();
        }
    });
}
function visitLabels(file, visitLabels, onFinished) {
    visitFile(file, function (allTextLines) {
        visitLabels(allTextLines[0].split(/,/).slice(4));
        if (onFinished != undefined) {
            onFinished();
        }
    });
}

class Country {
    constructor(name) {
        this.confirmed = [];
        this.recovered = [];
        this.deaths = [];
        this.name = name;
    }

    upperBoundValue(member) {
        if (member.length <= 0) {
            return -1;
        }
        return member[member.length - 1];
    }
    currentConfirmed() {
        return this.upperBoundValue(this.confirmed);
    }
    currentRecovered() {
        return this.upperBoundValue(this.recovered);
    }
    currentDeaths() {
        return this.upperBoundValue(this.deaths);
    }

    addInts(lineData, member) {
        var ints = lineData.slice(4).map(function (item) { return parseInt(item, 10); });
        for (var i = member.length; i < ints.length; ++i) {
            member.push(0);
        }
        for (var i = 0; i < ints.length; ++i) {
            member[i] += ints[i];
        }
    }
    addConfirmed(lineData) { this.addInts(lineData, this.confirmed); }
    addRecovered(lineData) { this.addInts(lineData, this.recovered); }
    addDeaths(lineData) { this.addInts(lineData, this.deaths); }

    average4DayGrowth() {
        return -1;
    }
};
class Countries {
    constructor() {
        this.countries = new Map();
        this.labels = [];
    }
    static load(onFinished) {
        var cs = new Countries();
        visitLabels('confirmed', function (labelsData) { cs.labels = labelsData; }, function () {
            visitLineData('confirmed', function (lineData) {
                var country = cs.countries.get(lineData[1]);
                if (country == undefined) {
                    country = new Country(lineData[1]);
                    cs.countries.set(lineData[1], country);
                }
                country.addConfirmed(lineData);
            }, function () {
                visitLineData('recovered', function (lineData) {
                    var country = cs.countries.get(lineData[1]);
                    if (country == undefined) {
                        country = new Country(lineData[1]);
                        cs.countries.set(lineData[1], country);
                    }
                    country.addRecovered(lineData);
                }, function () {
                    visitLineData('deaths', function (lineData) {
                        var country = cs.countries.get(lineData[1]);
                        if (country == undefined) {
                            country = new Country(lineData[1]);
                            cs.countries.set(lineData[1], country);
                        }
                        country.addDeaths(lineData);
                    }, function () { onFinished(cs); });
                });
            });
        });
    }
    sortByConfirmed() {
        var sortByConfirmed = [];
        this.countries.forEach(function (value) {
            sortByConfirmed.push(value);
        });
        sortByConfirmed.sort(function (a, b) {
            if (a.currentConfirmed() > b.currentConfirmed()) {
                return -1;
            }
            if (a.currentConfirmed() < b.currentConfirmed()) {
                return 1;
            }
            return 0;
        });
        return sortByConfirmed;
    }
};

function fillSelect(chart, country, countries) {
    var select = document.getElementById('selectCountry');
    countries.sortByConfirmed().forEach(function (value) {
        var opt = document.createElement('option');
        opt.innerHTML = value.name + ' (' + value.currentConfirmed() + ')';
        opt.id = value.name;
        select.appendChild(opt);
        if (value.name == country) {
            select.selectedIndex = select.length - 1;
            opt.select = true;
        }
    });
    select.onchange = function () {
        var option = select.options[select.selectedIndex];
        fillChart(chart, option.id, countries);
    };
}
function fillChart(chart, country, countries) {
    chart.data.labels = countries.labels;
    chart.data.datasets = [];
    countries.countries.forEach(function (value, key) {
        if (key == country) {
            chart.data.datasets.push({ label: 'confirmed (' + value.currentConfirmed() + ')', fill: false, borderColor: 'rgb(255, 99, 132)', data: value.confirmed });
            chart.data.datasets.push({ label: 'recovered (' + value.currentRecovered() + ')', fill: false, borderColor: 'rgb(0, 204, 102)', data: value.recovered });
            chart.data.datasets.push({ label: 'deaths (' + value.currentDeaths() + ')', fill: false, borderColor: 'rgb(0, 0, 0)', data: value.deaths });
        }
    });
    chart.update();

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
    Countries.load(function (countries) {
        fillSelect(chart, country, countries);
        fillChart(chart, country, countries);
    });
}