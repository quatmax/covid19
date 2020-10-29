function formatFloat(f) {
    var formatted = f.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (f < 0.0) {
        return '-' + formatted;
    }
    else {
        return '+' + formatted;
    }
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
            var line = allTextLines[index].replace('"Korea, South"', 'South Korea').replace('"Bonaire, Sint Eustatius and Saba"', 'Sint Eustatius and Saba');
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
        this.ill = [];
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
    currentIll() {
        return this.currentConfirmed() - this.currentRecovered() - this.currentDeaths();
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
    addRecovered(lineData) { this.addRecoveredInts(this.toInts(lineData)); }
    addDeaths(lineData) { this.addDeathsInts(this.toInts(lineData)); }
    addConfirmedInts(ints) {
        this.addInts(ints, this.confirmed);
        this.addInts(ints, this.ill);
    }
    addRecoveredInts(ints) {
        this.addInts(ints, this.recovered);
        this.minusInts(ints, this.ill);
    }
    addDeathsInts(ints) {
        this.addInts(ints, this.deaths);
        this.minusInts(ints, this.ill);
    }

    average4DayGrowth() {
        var diff = 0.0;
        for (var i = this.confirmed.length - 1; i >= this.confirmed.length - 5; --i) {
            var pre = this.confirmed[i - 1];
            if (pre == 0) {
                continue;
            }
            diff += ((this.confirmed[i] - pre) / pre) * 100.0;
        }
        return Number.parseFloat(diff / 4.0);
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
                visitLineData('recovered', function (lineData) {
                    cs.countries.get(lineData[1]).addRecovered(lineData);
                }, function () {
                    visitLineData('deaths', function (lineData) {
                        cs.countries.get(lineData[1]).addDeaths(lineData);
                    }, function () {
                        cs.sumWorld();
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
    sortByRecovered() {
        return this.sortBy(function (a, b) {
            if (a.currentRecovered() > b.currentRecovered()) {
                return -1;
            }
            if (a.currentRecovered() < b.currentRecovered()) {
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
    sortByIll() {
        return this.sortBy(function (a, b) {
            if (a.currentIll() > b.currentIll()) {
                return -1;
            }
            if (a.currentIll() < b.currentIll()) {
                return 1;
            }
            return 0;
        });
    }
    sortBy4dAvg() {
        return this.sortBy(function (a, b) {
            if (a.average4DayGrowth() > b.average4DayGrowth()) {
                return -1;
            }
            if (a.average4DayGrowth() < b.average4DayGrowth()) {
                return 1;
            }
            return 0;
        });
    }
    sumWorld() {
        this.countries.forEach(function (value) {
            this.world.addConfirmedInts(value.confirmed);
            this.world.addRecoveredInts(value.recovered);
            this.world.addDeathsInts(value.deaths);
        }, this);
    }

    totalConfirmedNumber() {
        return this.world.currentConfirmed();
    }

    totalConfirmed() {
        return formatNumber(this.totalConfirmedNumber());
    }
    totalRecoveredNumber() {
        return this.world.currentRecovered();
    }
    totalRecovered() {
        return formatNumber(this.totalRecoveredNumber());
    }
    totalDeathsNumber() {
        return this.world.currentDeaths();
    }
    totalDeaths() {
        return formatNumber(this.totalDeathsNumber());
    }
    totalIllNumber() {
        return this.world.currentIll();
    }
    totalIll() {
        return formatNumber(this.totalIllNumber());
    }
    total4dAvgNumber() {
        return this.world.average4DayGrowth();
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
        opt.innerHTML = (index + 1) + '. ' + value.name + ' (' + formatNumber(value.currentConfirmed()) + ')';
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
    chart.data.datasets.push({ label: 'confirmed (' + formatNumber(value.currentConfirmed()) + ')', fill: false, borderColor: 'rgb(255, 99, 132)', data: value.confirmed });
    chart.data.datasets.push({ label: 'recovered (' + formatNumber(value.currentRecovered()) + ')', fill: false, borderColor: 'rgb(0, 204, 102)', data: value.recovered });
    chart.data.datasets.push({ label: 'deaths (' + formatNumber(value.currentDeaths()) + ')', fill: false, borderColor: 'rgb(0, 0, 0)', data: value.deaths });
    chart.data.datasets.push({ label: 'ill (' + formatNumber(value.currentIll()) + ')', fill: false, borderColor: 'rgb(252, 186, 3)', data: value.ill });
    chart.update();
    fillInfos(country, countries);
}
function format4dAvg(button, f4dAvg, prefix) {
    button.innerHTML = prefix + formatFloat(f4dAvg);
    if (f4dAvg < 10.0) {
        button.className = 'btn btn-outline-success mr-3';
    }
    else if (f4dAvg < 20.0) {
        button.className = 'btn btn-outline-warning mr-3';
    }
    else if (f4dAvg < 100.0) {
        button.className = 'btn btn-outline-danger mr-3';
    }
}
function fillInfos(country, countries) {
    var value = countries.getCountry(country);
    format4dAvg(document.getElementById('button4dAvg'), value.average4DayGrowth(), "4d avg. ");
    var buttonIll = document.getElementById('buttonIll');
    buttonIll.innerHTML = 'current ill ' + formatNumber(value.currentIll());
}
function fillTotals(chart, country, countries) {
    var confirmed = document.getElementById('buttonTotalConfirmed');
    confirmed.innerHTML = 'Total confirmed: ' + countries.totalConfirmed();
    confirmed.classList.add('active');
    var recovered = document.getElementById('buttonTotalRecovered');
    recovered.innerHTML = 'Total recovered: ' + countries.totalRecovered();
    var deaths = document.getElementById('buttonTotalDeaths');
    deaths.innerHTML = 'Total deaths: ' + countries.totalDeaths();
    var ill = document.getElementById('buttonTotalIll');
    ill.innerHTML = 'Total ill: ' + countries.totalIll();
    var avg = document.getElementById('buttonTotal4dAvg');
    format4dAvg(avg, countries.total4dAvgNumber(), "Total 4d avg. ");

    confirmed.onclick = function () {
        confirmed.classList.add('active');
        recovered.classList.remove('active');
        deaths.classList.remove('active');
        ill.classList.remove('active');
        avg.classList.remove('active');
        fillSelectSorted(chart, undefined, countries, countries.sortByConfirmed())
    }
    recovered.onclick = function () {
        confirmed.classList.remove('active');
        recovered.classList.add('active');
        deaths.classList.remove('active');
        ill.classList.remove('active');
        avg.classList.remove('active');
        fillSelectSorted(chart, undefined, countries, countries.sortByRecovered())
    }
    deaths.onclick = function () {
        confirmed.classList.remove('active');
        recovered.classList.remove('active');
        deaths.classList.add('active');
        ill.classList.remove('active');
        avg.classList.remove('active');
        fillSelectSorted(chart, undefined, countries, countries.sortByDeaths())
    }
    ill.onclick = function () {
        confirmed.classList.remove('active');
        recovered.classList.remove('active');
        deaths.classList.remove('active');
        ill.classList.add('active');
        avg.classList.remove('active');
        fillSelectSorted(chart, undefined, countries, countries.sortByIll())
    }
    avg.onclick = function () {
        confirmed.classList.remove('active');
        recovered.classList.remove('active');
        deaths.classList.remove('active');
        ill.classList.remove('active');
        avg.classList.add('active');
        fillSelectSorted(chart, undefined, countries, countries.sortBy4dAvg())
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
        fillTotals(chart, country, countries);
        fillSelect(chart, country, countries);
        fillChart(chart, country, countries);
    });
}