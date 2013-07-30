
var scheduler = new Scheduler();
var config = new Config(localStorage.getItem('scheduler'));

scheduler.authenticate(function() {

	$.getJSON('data.json.php', function(data) {

		var taskCount = 0, ticketCount = 0;

		scheduler.visibleDays((data.days || []).map(function(date) {
			return new Day(new Date(date));
		}));

		$('.loading').hide();
		$('.users table').show();

		Task.prototype.taskStatuses = data.taskStatuses.map(function(status) {
			return new TaskStatus(status);
		});

		Ticket.prototype.projectStatuses = data.projectStatuses.map(function(status) {
			return new ProjectStatus(status);
		});

		scheduler.incompleteProjectStatuses = ko.computed(function() {
			return ko.utils.arrayFilter(Ticket.prototype.projectStatuses, function(status) {
				return !status.complete;
			});
		});

		scheduler.tickets((data.tickets || []).map(function(ticket) {
			ticketCount++;
			return new Ticket(ticket);
		}));

		var activeUsers = config.get('activeUsers') || {};
		scheduler.users((data.users || []).map(function(user) {
			user.active = typeof activeUsers[user.id] === 'undefined'? true : activeUsers[user.id];
			userObj = new User(user);
			userObj.tasks((user.tasks || []).map(function(task) {
				taskCount++;
				task.ticket = ko.utils.arrayFirst(scheduler.tickets(), function(ticket) {
					return ticket.id == task.project_uid;
				});
				task.user = userObj;
				return new Task(task);
			}));
			return userObj;
		}));

		console.log('tasks: ' + taskCount);
		console.log('tickets: ' + ticketCount);

		$('.popup .close').on('click', function() {
			$(this).parent('.popup').hide();
		});

		$('.users').on('click', '.task', function() {
			$('.popup').hide();
			scheduler.selectedTask(ko.dataFor(this));
			$('.popup').show();
		});

		window.location.hash = 'day-' + new Date().toISOString().substr(0, 10);

		ko.applyBindings(scheduler);

		//scheduler.setupDataPolling(10);

	}).fail(function() {
		alert('Could not find a data.json file, or there was a problem with the JSON file.');
	});

}, function(jqXHR, textStatus, errorThrown) {
	alert(errorThrown);
});

ko.bindingHandlers.sortable = {
	init: function(element, valueAccessor, allBindingsAccessor, viewModel, context) {
		$(element).sortable($.extend({
			placeholder: 'ui-sortable-placeholder',
			forcePlaceholderSize: true,
			connectWith: '.' + element.className,
			revert: 50,
			scroll: false,
			receive: function(event, ui) {
				var day = context.$parent;
				var item = ko.dataFor(ui.item[0]);
				var totalTime = viewModel.totalEstimatedTime(day);
				var task;
				var overflow;
				if (totalTime >= 8) {
					try {
						ui.sender.sortable('cancel');
					} catch (e) {
						// nothing
					} finally {
						return;
					}
				}
				if (ui.item.hasClass('ticket')) {
					task = new Task({
						ticket: item,
						uid: 'NEW',
						task_status_uid: 2,
						priority: $(this).find('.ticket').getPriority() || 50,
						estimated_time: 1
					});
				} else {
					task = item;
					ui.item.remove();
				}

				task.user(viewModel);
				task.date = day.date;
				overflow = totalTime + task.estimatedTime() - 8;
				if (overflow > 0)
					task.estimatedTime(task.estimatedTime() - overflow);

				context.$root.save(task);
				viewModel.tasks.push(task);
			},
			remove: function(event, ui) {
				var context = ko.contextFor(ui.item[0]);
				context.$parent.tasks.remove(context.$data);
			},
			update: function(event, ui) {
				$(this).sortable('refresh');
				if (ui.item.hasClass('ticket'))
					ui.item.remove();
				if (!ui.sender) {
					if (newPriority = ui.item.getPriority())
						ko.dataFor(ui.item[0]).priority(newPriority);
				}
			}
		}, valueAccessor()));
	}
};

$.fn.getPriority = function() {
	var newPriority;
	if (this.prev('.task').length)
		newPriority = ko.dataFor(this.prev('.task')[0]).priority()-1;
	else if (this.next('.task').length)
		newPriority = ko.dataFor(this.next('.task')[0]).priority()+1;
	return newPriority;
};

ko.bindingHandlers.draggable = {
	init: function(element, valueAccessor) {
		$(element).draggable($.extend({
			helper: "clone",
			revert: "invalid",
			snapMode: 'inner',
			snapTolerance: 20,
			revertDuration: 200,
			scroll: false,
			appendTo: 'body',
			zIndex: 2
		}, valueAccessor()));
	}
};

ko.bindingHandlers.resizable = {
	init: function(element, valueAccessor, allBindingsAccessor, viewModel, context) {
		var containerHeight = $(element).parent().height();
		var hours = 8;
		$(element)
			.resizable($.extend({
				handles: 's',
				grid: [0, 10],
				resize: function() {
					var height = $(this).height();
					viewModel.estimatedTime(height / 40);
				},
				stop: function() {
					context.$root.save(viewModel);
				}
			}, valueAccessor()));
	},
	update: function(el, value, all, model, context) {
		if (!model.status().completed) {
			var hours = 8,
			    containerHeight = $(el).parent().height(),
			    task = context.$data,
			    user = context.$parent,
			    day = context.$parents[1],
			    maxHours = hours - user.totalEstimatedTime(day) + model.estimatedTime();
			$(el).resizable('option', 'minHeight', task.billedTime() * 40);
		} else {
			$(el).resizable('disable');
		}
	}
};

ko.bindingHandlers.doubleClick = {
	init: function(element, valueAccessor, allBindingsAccessor, viewModel) {
		$(element).dblclick(function() {
			valueAccessor().call(viewModel);
		});
	}
};
