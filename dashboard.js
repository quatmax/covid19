// Return array of string values, or NULL if CSV string not well formed.
function CSVtoArray(text) {
    var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;

    // Return NULL if input string is not well formed CSV string.
    if (!re_valid.test(text)) return null;

    var a = []; // Initialize array to receive values.
    text.replace(re_value, // "Walk" the string using replace with callback.
        function (m0, m1, m2, m3) {

            // Remove backslash from \' in single quoted values.
            if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));

            // Remove backslash from \" in double quoted values.
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
            else if (m3 !== undefined) a.push(m3);
            return ''; // Return empty string.
        });

    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) a.push('');
    return a;
}

function formatNumber(f) {
    return f.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getFileName(file) {
    return "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_" + file + "_global.csv";
}

function getCountryInfoFile() {
    return "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/UID_ISO_FIPS_LookUp_Table.csv";
}

function visitRawFile(filename, visitor) {
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

function visitRawLineData(file, visitLine, onFinished) {
    visitRawFile(file, function (allTextLines) {
        for (var index = 1; index < allTextLines.length; index++) {
            var line = allTextLines[index].replaceAll("'", "");
            if (line.trim().length == 0) {
                continue;
            }
            visitLine(CSVtoArray(line));
        }
        if (onFinished != undefined) {
            onFinished();
        }
    });
}

function visitLineData(file, visitLine, onFinished) {
    visitRawLineData(getFileName(file), visitLine, onFinished);
}

function visitLabels(file, visitLabels, onFinished) {
    visitRawFile(getFileName(file), function (allTextLines) {
        visitLabels(allTextLines[0].split(/,/).slice(4));
        if (onFinished != undefined) {
            onFinished();
        }
    });
}

class Country {
    constructor(name) {
        this.confirmed = [];
        this.deaths = [];
        this.incidence = [];
        this.population = 0.0;
        this.name = name;
    }

    value(member, index) {
        if (member.length <= 0) {
            return 0;
        }
        if (index >= member.length || index < 0) {
            return 0;
        }
        return member[index];
    }
    upperBoundValue(member) {
        return this.value(member, member.length - 1);
    }
    currentConfirmedDeltaAt(index) {
        return this.value(this.confirmed, index) - this.value(this.confirmed, index - 1);
    }

    currentConfirmed() {
        return this.upperBoundValue(this.confirmed);
    }
    currentDeaths() {
        return this.upperBoundValue(this.deaths);
    }
    toInts(lineData) {
        return lineData.slice(4).map(function (item) {
            if (item == "") {
                return 0;
            }
            return parseInt(item, 10);
        });
    }
    sumInts(ints, member, sign) {
        for (var i = member.length; i < ints.length; ++i) {
            member.push(0);
        }
        for (var i = 0; i < ints.length; ++i) {
            member[i] += ints[i] * sign;
        }
    }
    addInts(ints, member) {
        this.sumInts(ints, member, +1);
    }
    minusInts(ints, member) {
        this.sumInts(ints, member, -1);
    }
    addConfirmed(lineData) { this.addConfirmedInts(this.toInts(lineData)); }
    addDeaths(lineData) { this.addDeathsInts(this.toInts(lineData)); }
    addPopulation(lineData) {
        if (lineData[11].trim().length > 0) {
            this.population += parseFloat(lineData[11]);
        }
    }
    getPopulation() {
        return this.population;
    }
    addConfirmedInts(ints) {
        this.addInts(ints, this.confirmed);
    }
    addDeathsInts(ints) {
        this.addInts(ints, this.deaths);
    }
    currentIncidence() {
        return this.upperBoundValue(this.incidence);
    }
    calcIncidences() {
        this.incidence = [];
        for (var i = 0; i < this.confirmed.length; ++i) {
            this.incidence.push(this.calcIncidence(i));
        }
    }
    calcIncidence(atIndex) {
        let sumConfirmed = 0.0;
        for (let i = 0; i < 7; ++i) {
            let index = atIndex - i;
            sumConfirmed += this.currentConfirmedDeltaAt(index);
        }
        if (this.getPopulation() == 0) {
            return 0;
        }
        return (sumConfirmed / this.getPopulation()) * 100000.0;
    }
};
class Countries {
    constructor() {
        this.countries = new Map();
        this.labels = [];
        this.world = new Country("World");
        this.countries.set("World", this.world);
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
                visitLineData('deaths', function (lineData) {
                    cs.countries.get(lineData[1]).addDeaths(lineData);
                }, function () {
                    visitRawLineData(getCountryInfoFile(), function (lineData) {
                        var country = cs.countries.get(lineData[7]);
                        if (country != undefined && lineData[6].length == 0) {
                            country.addPopulation(lineData);
                        }
                    }, function () {
                        cs.sumWorld();
                        cs.calcIncidences();
                        onFinished(cs);
                    });
                });
            });
        });
    }
    getCountry(country) {
        return this.countries.get(country);
    }
    sortBy(sorter) {
        var sortBy = [];
        this.countries.forEach(function (value) {
            sortBy.push(value);
        });
        sortBy.sort(function (a, b) { return sorter(a, b); });
        return sortBy;
    }

    sortByConfirmed() {
        return this.sortBy(function (a, b) {
            if (a.currentConfirmed() > b.currentConfirmed()) {
                return -1;
            }
            if (a.currentConfirmed() < b.currentConfirmed()) {
                return 1;
            }
            return 0;
        });
    }
    sortByDeaths() {
        return this.sortBy(function (a, b) {
            if (a.currentDeaths() > b.currentDeaths()) {
                return -1;
            }
            if (a.currentDeaths() < b.currentDeaths()) {
                return 1;
            }
            return 0;
        });
    }
    sortByIncidence() {
        return this.sortBy(function (a, b) {
            if (a.currentIncidence() > b.currentIncidence()) {
                return -1;
            }
            else if (a.currentIncidence() < b.currentIncidence()) {
                return 1;
            }
            return 0;
        });
    }
    sumWorld() {
        this.countries.forEach(function (value) {
            this.world.addConfirmedInts(value.confirmed);
            this.world.addDeathsInts(value.deaths);
            this.world.population += value.getPopulation();
        }, this);
    }
    calcIncidences() {
        this.countries.forEach(function (value) {
            value.calcIncidences();
        }, this);
        this.world.calcIncidences();
    }

    totalConfirmedNumber() {
        return this.world.currentConfirmed();
    }

    totalConfirmed() {
        return formatNumber(this.totalConfirmedNumber());
    }
    totalDeathsNumber() {
        return this.world.currentDeaths();
    }
    totalDeaths() {
        return formatNumber(this.totalDeathsNumber());
    }
    totalIncidence() {
        return this.world.currentIncidence();
    }
};

function fillSelectSorted(chart, country, countries, sortedCountries) {
    var select = document.getElementById('selectCountry');
    var c = country;
    if (c == undefined) {
        c = select.options[select.selectedIndex].id;
    }
    select.innerHTML = '';
    sortedCountries.forEach(function (value, index) {
        var opt = document.createElement('option');
        opt.innerHTML = (index + 1) + '. ' + value.name + ' (' + formatNumber(value.currentIncidence()) + ')';
        opt.id = value.name;
        select.appendChild(opt);
        if (value.name == c) {
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
    chart.data.datasets.push({ yAxisID: 'A', label: 'incidence (' + formatNumber(value.currentIncidence()) + ')', fill: false, borderColor: 'rgb(252, 186, 3)', data: value.incidence, pointRadius: 0 });
    chart.data.datasets.push({ yAxisID: 'B', label: 'deaths (' + formatNumber(value.currentDeaths()) + ')', fill: false, borderColor: 'rgb(0, 0, 0)', data: value.deaths, pointRadius: 0 });
    chart.update();
    fillInfos(country, countries);
}
function formatIncidence(button, incidence, prefix) {
    button.innerHTML = prefix + formatNumber(incidence);
    if (incidence < 100) {
        button.className = 'btn btn-outline-success mr-3';
    }
    else if (incidence < 200) {
        button.className = 'btn btn-outline-warning mr-3';
    }
    else {
        button.className = 'btn btn-outline-danger mr-3';
    }
}
function fillInfos(country, countries) {
    var value = countries.getCountry(country);
    formatIncidence(document.getElementById('buttonIncidence'), value.currentIncidence(), "Incidence ");
}
function fillTotals(chart, country, countries) {
    var confirmed = document.getElementById('buttonTotalConfirmed');
    confirmed.innerHTML = 'Total confirmed: ' + countries.totalConfirmed();
    confirmed.classList.add('active');
    var deaths = document.getElementById('buttonTotalDeaths');
    deaths.innerHTML = 'Total deaths: ' + countries.totalDeaths();
    var avg = document.getElementById('buttonTotalIncidence');
    formatIncidence(avg, countries.totalIncidence(), "Total Incidence ");

    confirmed.onclick = function () {
        confirmed.classList.add('active');
        deaths.classList.remove('active');
        avg.classList.remove('active');
        fillSelectSorted(chart, undefined, countries, countries.sortByConfirmed())
    }
    deaths.onclick = function () {
        confirmed.classList.remove('active');
        deaths.classList.add('active');
        avg.classList.remove('active');
        fillSelectSorted(chart, undefined, countries, countries.sortByDeaths())
    }
    avg.onclick = function () {
        confirmed.classList.remove('active');
        deaths.classList.remove('active');
        avg.classList.add('active');
        fillSelectSorted(chart, undefined, countries, countries.sortByIncidence())
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
    var chart = new Chart(ctx, { type: 'line', options: { maintainAspectRatio: false, scales: { yAxes: [{ id: 'A', type: 'linear', position: 'left' }, { id: 'B', type: 'linear', position: 'right', gridLines: { display: false } }] } } });
    Countries.load(function (countries) {
        fillTotals(chart, country, countries);
        fillSelect(chart, country, countries);
        fillChart(chart, country, countries);
    });
}