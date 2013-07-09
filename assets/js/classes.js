
	function Task(data)
	{
		var self = this;
		this.id = data.uid || 'NEW';
		this.ticket = data.ticket || {};
		this.estimatedTime = ko.observable(data.estimatedTime || 0);
		this.billedTime = ko.observable(data.billedTime || 0);
		this.date = new Date(data.date) || new Date();
		this.status = ko.observable(data.task_status_uid);
		this.priority = ko.observable(isNaN(data.priority) && 50 || data.priority);
		this.overflow = ko.observable(false);
		this.timeTaken = ko.computed(function() {
			return Math.max(self.estimatedTime(), self.billedTime());
		});
		this.getStatus = function() {
			return self.taskStatuses[self.status()] || {};
		};
		this.size = ko.computed(function() {
			if (self.getStatus().completed)
				return self.billedTime();
			else
				return (self.timeTaken() * 40) + 'px';
		});
		this.label = ko.computed(function() {
			return '#' + this.id + ' ' + this.ticket.name + ' (' + this.timeTaken() + 'hrs)';// + '[' + this.priority() + ']';
		}, this);
	}

	function Ticket(data)
	{
		this.id = data.uid || null;
		this.summary = data.summary;
		this.name = data.name || '{' + this.id + '}';
		this.label = ko.computed(function() {
			var parts = [this.name, this.summary].filter(function(n) { return n; });
			return parts.join(' - ');
		}, this);
		this.project_status_uid = ko.observable(data.project_status_uid);
	}

	function User(data)
	{
		this.name = data.name;
		this.tasks = ko.observableArray(data.tasks);
		this.active = ko.observable(true);
		this.tasksByDay = function(day) {
			var sum = 0;
			var tasks = this.tasks();
			var overflow = false;
			tasks = ko.utils.arrayFilter(tasks, function(task) {
				if(day.isSameDay(task.date)) {
					sum += task.timeTaken();
					overflow = sum > 8 && task.getStatus() == 'Pending';
					task.overflow(overflow);
					return !overflow;
				}
			});
			tasks.sort(function (l, r) {
				if (l.priority() === r.priority())
					return l.getStatus() == 'Pending'? 1 : -1;
				else
					return l.priority() > r.priority() ? -1 : 1;
			});
			return tasks;
		};
		this.overflowTasks = function(day) {
			return ko.utils.arrayFilter(this.tasks(), function(task) {
				return day.isSameDay(task.date) && task.overflow();
			});
		};
		this.toggleInactivity = function() {
			this.active(!this.active());
		};
		this.totalEstimatedTime = function(day) {
			var total = 0;
			var tasks = ko.utils.arrayFilter(this.tasks(), function(task) {
				return day.isSameDay(task.date);
			});
			ko.utils.arrayForEach(tasks, function(task) {
				total += task.timeTaken();
			});
			return total;
		};
		this.fitTask = function(task, day) {
			task.overflow(false);
			var overflow = this.totalEstimatedTime(day) - 8;
			task.estimatedTime(task.estimatedTime() - overflow);
		};
		/* Test */
		this.addTask = function() {
			this.tasks.push(new Task({priority: 0, date: '2013-06-29', task_status_uid: 2, ticket: new Ticket({summary: 'Testing'})}));
		};
	}

	function Day(date)
	{
		var self = this;
		this.date = date;
		this.isSameDay = function(date) {
			return date.toISOString().substr(0, 10) == self.date.toISOString().substr(0, 10);
		};
	}
