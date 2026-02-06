const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad2 = (value) => (value >= 10 ? `${value}` : `0${value}`);

const getOrdinal = (day) => {
    switch (day) {
        case 1:
        case 21:
        case 31:
            return "st";
        case 2:
        case 22:
            return "nd";
        case 3:
        case 23:
            return "rd";
        default:
            return "th";
    }
};

function formatDateTime(funcDate, longRelativeTime = false) {
    try {
        // Get and Check date
        if (!funcDate) funcDate = new Date().toISOString();
        const date = new Date(funcDate);
        if (isNaN(date.getTime())) throw new Error("Invalid Date");

        // relative time from now eg "3 hours ago" or "in 3 days"
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const diffYears = Math.floor(diff / (1000 * 3600 * 24 * 30 * 12));
        const diffMonths = Math.floor(diff / (1000 * 3600 * 24 * 30));
        const diffDays = Math.floor(diff / (1000 * 3600 * 24));
        const diffHours = Math.floor(diff / (1000 * 3600));
        const diffMinutes = Math.floor(diff / (1000 * 60));
        const diffSeconds = Math.floor(diff / 1000);

        let relativeTime = "";
        if (diffYears > 0 && longRelativeTime) {
            relativeTime = `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
        } else if (diffMonths > 0 && longRelativeTime) {
            relativeTime = `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
        } else if (diffDays > 0) {
            relativeTime = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
        } else if (diffHours > 0) {
            relativeTime = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        } else if (diffMinutes > 0) {
            relativeTime = `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
        } else if (diffSeconds > 0) {
            relativeTime = `${diffSeconds} second${diffSeconds > 1 ? "s" : ""} ago`;
        } else if (diffYears < 0 && longRelativeTime) {
            relativeTime = `in ${Math.abs(diffYears)} year${diffYears < -1 ? "s" : ""}`;
        } else if (diffMonths < 0 && longRelativeTime) {
            relativeTime = `in ${Math.abs(diffMonths)} month${diffMonths < -1 ? "s" : ""}`;
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

        return {
            success: true,
            date: `${date.getDate()}`,
            dateName: `${dayNames[date.getDay()]}`,
            ordinal: `${getOrdinal(date.getDate())}`,
            month: `${date.getMonth() + 1}`,
            monthName: `${monthNames[date.getMonth()]}`,
            year: `${date.getFullYear()}`,
            time: {
                hours: pad2(date.getHours()),
                minutes: pad2(date.getMinutes()),
                seconds: pad2(date.getSeconds()),
            },
            relativeTime: `${relativeTime}`,
            dateTime: `${date.toISOString()}`,
        };
    } catch (err) {
        return {
            success: false,
        };
    }
}

module.exports = formatDateTime;
