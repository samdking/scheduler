
	function Task(data)
	{
		var self = this;
		this.id = data.uid || 'NEW';
		this.ticket = data.ticket || {};
		this.estimatedTime = ko.observable(data.estimatedTime || 1);
		this.billedTime = ko.observable(data.billedTime || 0);
		this.date = new Date(data.date) || new Date();
		this.status = ko.observable(data.task_status_uid);
		this.priority = ko.observable(isNaN(data.priority) && 50 || data.priority);
		this.overflow = ko.observable(false);
		this.size = ko.computed(function() {
			return (self.estimatedTime() * 40) + 'px';
		});
		this.getStatus = function() {
			return self.taskStatuses[self.status()] || '';
		};
		this.fillTime = function() {
			this.estimatedTime(4);
		};

		this.label = ko.computed(function() {
			return '#' + this.id + ' ' + this.ticket.summary + ' (' + this.estimatedTime() + 'hrs) [' + this.priority() + ']';
		}, this);
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
		this.active = ko.observable(true);
		this.tasksByDay = function(day) {
			var sum = 0;
			var tasks = this.tasks();
			tasks = ko.utils.arrayFilter(tasks, function(task) {
				if(day.isSameDay(task.date)) {
					sum += task.estimatedTime();
					task.overflow(sum > 8);
					return sum <= 8;
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
				total += task.estimatedTime();
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
