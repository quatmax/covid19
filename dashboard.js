function formatFloat(f) {
    return f.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatNumber(f) {
    return f.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

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
            var line = allTextLines[index].replace('"Korea, South"', 'South Korea');
            if (line.trim().length == 0) {
                continue;
            }
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
        var diff = 0.0;
        for (var i = this.confirmed.length - 1; i >= this.confirmed.length - 5; --i) {
            diff += ((this.confirmed[i] - this.confirmed[i - 1]) / this.confirmed[i - 1]) * 100.0;
        }
        return Number.parseFloat(diff / 4.0);
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
    getCountry(country) {
        return this.countries.get(country);
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
    sortByRecovered() {
        var sortByRecovered = [];
        this.countries.forEach(function (value) {
            sortByRecovered.push(value);
        });
        sortByRecovered.sort(function (a, b) {
            if (a.currentRecovered() > b.currentRecovered()) {
                return -1;
            }
            if (a.currentRecovered() < b.currentRecovered()) {
                return 1;
            }
            return 0;
        });
        return sortByRecovered;
    }
    sortByDeaths() {
        var sortByDeaths = [];
        this.countries.forEach(function (value) {
            sortByDeaths.push(value);
        });
        sortByDeaths.sort(function (a, b) {
            if (a.currentDeaths() > b.currentDeaths()) {
                return -1;
            }
            if (a.currentDeaths() < b.currentDeaths()) {
                return 1;
            }
            return 0;
        });
        return sortByDeaths;
    }
    totalConfirmed() {
        var totalConfirmed = 0;
        this.countries.forEach(function (value) {
            totalConfirmed += Math.max(0, value.currentConfirmed());
        });
        return formatNumber(totalConfirmed);
    }
    totalRecovered() {
        var totalRecovered = 0;
        this.countries.forEach(function (value) {
            totalRecovered += Math.max(0, value.currentRecovered());
        });
        return formatNumber(totalRecovered);
    }
    totalDeaths() {
        var totalDeaths = 0;
        this.countries.forEach(function (value) {
            totalDeaths += Math.max(0, value.currentDeaths());
        });
        return formatNumber(totalDeaths);
    }
};

function fillSelectSorted(chart, country, countries, sortedCountries) {
    var select = document.getElementById('selectCountry');
    select.innerHTML = '';
    sortedCountries.forEach(function (value, index) {
        var opt = document.createElement('option');
        opt.innerHTML = (index + 1) + '. ' + value.name + ' (' + value.currentConfirmed() + ')';
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

function fillSelect(chart, country, countries) {
    fillSelectSorted(chart, country, countries, countries.sortByConfirmed());
}
function fillChart(chart, country, countries) {
    chart.data.labels = countries.labels;
    chart.data.datasets = [];
    var value = countries.getCountry(country);
    chart.data.datasets.push({ label: 'confirmed (' + value.currentConfirmed() + ')', fill: false, borderColor: 'rgb(255, 99, 132)', data: value.confirmed });
    chart.data.datasets.push({ label: 'recovered (' + value.currentRecovered() + ')', fill: false, borderColor: 'rgb(0, 204, 102)', data: value.recovered });
    chart.data.datasets.push({ label: 'deaths (' + value.currentDeaths() + ')', fill: false, borderColor: 'rgb(0, 0, 0)', data: value.deaths });
    chart.update();
    fillInfos(country, countries);
}
function fillInfos(country, countries) {
    var value = countries.getCountry(country);
    var button = document.getElementById('button4dAvg');
    button.innerHTML = 'avg. 4d +' + formatFloat(value.average4DayGrowth());
    if (value.average4DayGrowth() < 10.0) {
        button.className = 'btn btn-outline-success';
    }
    else if (value.average4DayGrowth() < 20.0) {
        button.className = 'btn btn-outline-warning';
    }
    else if (value.average4DayGrowth() < 100.0) {
        button.className = 'btn btn-outline-danger';
    }
}
function fillTotals(chart, country, countries) {
    var confirmed = document.getElementById('buttonTotalConfirmed');
    confirmed.innerHTML = 'Total confirmed: ' + countries.totalConfirmed();
    confirmed.classList.add('active');
    var recovered = document.getElementById('buttonTotalRecovered');
    recovered.innerHTML = 'Total recovered: ' + countries.totalRecovered();
    var deaths = document.getElementById('buttonTotalDeaths');
    deaths.innerHTML = 'Total deaths: ' + countries.totalDeaths();

    confirmed.onclick = function() {
        confirmed.classList.add('active');
        recovered.classList.remove('active');
        deaths.classList.remove('active');
        fillSelectSorted(chart, country, countries, countries.sortByConfirmed())
    }
    recovered.onclick = function() {
        confirmed.classList.remove('active');
        recovered.classList.add('active');
        deaths.classList.remove('active');
        fillSelectSorted(chart, country, countries, countries.sortByRecovered())
    }
    deaths.onclick = function() {
        confirmed.classList.remove('active');
        recovered.classList.remove('active');
        deaths.classList.add('active');
        fillSelectSorted(chart, country, countries, countries.sortByDeaths())
    }
}
function getURLCountry() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const key = 'country';
    var country = 'Austria';
    if (urlParams.has(key)) {
        country = urlParams.get(key);
    }
    return country;
}
function dashboard() {
    var country = getURLCountry();
    var ctx = document.getElementById('theChart').getContext('2d');
    var chart = new Chart(ctx, { type: 'line', options: { maintainAspectRatio: false } });
    Countries.load(function (countries) {
        fillSelect(chart, country, countries);
        fillChart(chart, country, countries);
        fillTotals(chart, country, countries);
    });
}