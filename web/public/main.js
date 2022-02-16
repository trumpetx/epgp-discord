$(function() {
  const BASIC_JSON_REGEX = /^\s*\{.*(?!\})\s*$/gm;
  $('[data-toggle="tooltip"]').tooltip();
  $('#uploadModal').on('shown.bs.modal', function() {
    $('#uploadBackup').trigger('focus');
  });
  $('#currentRoster').DataTable({
    pageLength: 25,
    order: [[4, 'desc']]
  });
  $('#exampleTable').DataTable({
    paging: false,
    searching: false,
    bInfo: false,
    order: [[3, 'desc']]
  });
  $('#backups').DataTable({
    pageLength: 3,
    ordering: false,
    lengthMenu: [
      [3, 10, 25, 50, -1],
      [3, 10, 25, 50, 'All']
    ]
  });
  $('#loot').DataTable({
    paging: false,
    searching: false,
    bInfo: false,
    order: [[2, 'desc']]
  });
  $('.confirm').on('click', _evt => confirm('Are you sure?'));

  const validateInput = ($modal, $input, condition, errorMessage) => {
    if (condition) {
      $alert = $(
        `<div class="alert alert-danger alert-dismissible alert-dismissible fade show center" role="alert">
          ${errorMessage}
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>`
      );
      $input.val('');
      $modal.modal('hide');
      $('.alert').remove();
      $('.header').after($alert);
    }
    return !condition;
  };
  $('#aliasForm').on('submit', _evt => {
    const $advancedImport = $('#advancedImport');
    const $aliasModal = $('#aliasModal');
    const disabledJson = $advancedImport.prop('disabled');
    let isJson = false;
    if (!disabledJson) {
      try {
        JSON.parse($advancedImport.val());
        isJson = true;
      } catch (ignored) {}
    }
    return validateInput($aliasModal, $advancedImport, !disabledJson && !isJson, 'Invalid JSON - Make sure you copy/pasted the correct values');
  });
  $('#uploadBackupForm').on('submit', _evt => {
    const $uploadBackup = $(this).find('#uploadBackup');
    const $uploadModal = $('#uploadModal');
    return (
      validateInput(
        $uploadModal,
        $uploadBackup,
        !!$uploadBackup.val().match(/^\s*#/),
        'Unable to process the "Detailed Export" in .tsv format.  Please use the basic Export option.<br/><br/><img src="/import.png"/><br/>'
      ) &&
      validateInput(
        $uploadModal,
        $uploadBackup,
        !$uploadBackup.val().match(BASIC_JSON_REGEX),
        'Please paste the JSON "Export" from "Log"<br/><br/><img src="/import.png"/><br/>'
      )
    );
  });
  const onAdvancedChange = () => {
    const checked = $('#advancedModeCheckbox').prop('checked');
    ['#characterClass', '#characterAlias', '#characterName', '#characterNote'].forEach(el => $(el).prop('disabled', checked));
    $('#advancedImport').prop('disabled', !checked);
    $('.simpleModeGroup').toggle(!checked);
    $('.advancedModeGroup').toggle(checked);
  };
  $('#advancedModeCheckbox').change(onAdvancedChange);
  onAdvancedChange();

  const chart = document.getElementById('epgpChart');
  chart &&
    new Chart(chart.getContext('2d'), {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Effort Points',
            yAxisID: 'EPGP',
            borderColor: 'rgb(255,215,0)',
            data: epData
          },
          {
            label: 'Gear Points',
            yAxisID: 'EPGP',
            borderColor: 'rgb(148,0,211)',
            data: gpData
          },
          {
            label: 'Priority Ranking',
            yAxisID: 'PR',
            borderColor: 'rgb(0,204,102)',
            data: prData
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          xAxes: [
            {
              type: 'time'
            }
          ],
          yAxes: [
            {
              id: 'PR',
              type: 'linear',
              position: 'right',
              ticks: {
                max: Math.trunc(avgPr * 2.5),
                min: 0
              }
            },
            {
              id: 'EPGP',
              type: 'linear',
              position: 'left',
              ticks: {
                max: Math.trunc(maxEpgp * 1.2),
                min: 0
              }
            }
          ]
        }
      }
    });
});
