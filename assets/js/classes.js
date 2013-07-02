
	function Task(data)
	{
		var self = this;
		this.id = data.uid || null;
		this.ticket = data.ticket || {};
		this.estimatedTime = ko.observable(data.estimatedTime || 1);
		this.date = new Date(data.date) || new Date();
		this.status = ko.observable(data.task_status_uid);
		this.size = ko.computed(function() {
			return (self.estimatedTime() * 50) + 'px';
		});
		this.getStatus = function() {
			return self.taskStatuses[self.status()] || '';
		};
		this.fillTime = function() {
			this.estimatedTime(4);
		};
	}

	function Ticket(data)
	{
		this.id = data.uid || null;
		this.summary = data.summary;
	}

	function User(data)
	{
		this.name = data.name;
		this.tasks = ko.observableArray(data.tasks);
		this.tasksByDay = function(date) {
			return ko.utils.arrayFilter(this.tasks(), function(task) {
				return date.getTime() == task.date.getTime();
			});
		};
		this.active = ko.observable(true);
		this.toggleInactivity = function() {
			this.active(!this.active());
		};
		this.totalEstimatedTime = function(date) {
			var total = 0;
			ko.utils.arrayForEach(this.tasksByDay(date), function(task) {
				total += task.estimatedTime() * 1;
			});
			return total;
		};
	}

	function Day(date)
	{
		var self = this;
		this.date = date;
		this.isSameDay = function(date) {
			return date.toISOString().substr(0, 10) == self.date.toISOString().substr(0, 10);
		};
		var morning = new Date(date.getTime());
		var afternoon = new Date(date.getTime());
		var overtime = new Date(date.getTime());
		morning.setHours(9);
		afternoon.setHours(13);
		overtime.setHours(18);
		this.timePeriods = [morning, afternoon, overtime];
	}
