const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatDateTime(funcDate) {
    try {
        // Get and Check date
        if (!funcDate) funcDate = new Date().toISOString();
        let date = new Date(funcDate);
        if (isNaN(date.getTime())) throw new Error("Invalid Date");

        // format date
        // ordinal
        var ordinal = 'th';
        switch (date.getDate()) {
            case 1:
            case 21:
            case 31:
                ordinal = 'st';
                break;
            case 2:
            case 22:
                ordinal = 'nd';
                break;
            case 3:
            case 23:
                ordinal = 'rd';
                break;
        }

        // relative time from now eg "3 hours ago" or "in 3 days"
        let now = new Date();
        let diff = now.getTime() - date.getTime();
        let diffDays = Math.floor(diff / (1000 * 3600 * 24));
        let diffHours = Math.floor(diff / (1000 * 3600));
        let diffMinutes = Math.floor(diff / (1000 * 60));
        let diffSeconds = Math.floor(diff / (1000));

        let relativeTime = "";
        if (diffDays > 0) {
            relativeTime = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
        } else if (diffHours > 0) {
            relativeTime = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        } else if (diffMinutes > 0) {
            relativeTime = `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
        } else if (diffSeconds > 0) {
            relativeTime = `${diffSeconds} second${diffSeconds > 1 ? "s" : ""} ago`;
        } else if (diffDays < 0) {
            relativeTime = `in ${Math.abs(diffDays)} day${diffDays < -1 ? "s" : ""}`;
        } else if (diffHours < 0) {
            relativeTime = `in ${Math.abs(diffHours)} hour${diffHours < -1 ? "s" : ""}`;
        } else if (diffMinutes < 0) {
            relativeTime = `in ${Math.abs(diffMinutes)} minute${diffMinutes < -1 ? "s" : ""}`;
        } else if (diffSeconds < 0) {
            relativeTime = `in ${Math.abs(diffSeconds)} second${diffSeconds < -1 ? "s" : ""}`;
        } else {
            relativeTime = "just now";
        }

        // return date data
        return {
            success: true,
            date: `${date.getDate()}`,
            dateName: `${dayNames[date.getDay()]}`,
            ordinal: `${ordinal}`,
            month: `${date.getMonth() + 1}`,
            monthName: `${monthNames[date.getMonth()]}`,
            year: `${date.getFullYear()}`,
            time: {
                hours: `${(date.getHours() >= 10) ? `${date.getHours()}` : `0${date.getHours()}`}`,
                minutes: `${(date.getMinutes() >= 10) ? `${date.getMinutes()}` : `0${date.getMinutes()}`}`,
                seconds: `${(date.getSeconds() >= 10) ? `${date.getSeconds()}` : `0${date.getSeconds()}`}`,
            },
            relativeTime: `${relativeTime}`,
            dateTime: `${date.toISOString()}`,
        }
    } catch (err) {
        return {
            success: false,
        }
    }
}

module.exports = formatDateTime;