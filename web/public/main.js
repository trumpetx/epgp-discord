$(function() {
  $('#uploadModal').on('shown.bs.modal', function() {
    $('#uploadBackup').trigger('focus');
  });
  $('#currentRoster').DataTable({
    pageLength: 25,
    order: [[3, 'desc']]
  });
});
