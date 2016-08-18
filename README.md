# atlas-ui
Web platform that allows server lookup with modification abilities

Description:
AtlasUI is a tool to access and modify information on all servers within Geneva Trading. It can be accessed via: http://atlas.genevatrading.com/.
The homepage presents the user with a table containing the most relevant information on all servers.

Usage:

Home Page:
By default, the table is sorted by hostname. Clicking on the column headers will change the sort order based on that column.
Clicking on the blue Add/Remove Fields button (top left corner) will pull up a menu allowing users to choose which fields they want visible/hidden on the homepage.
Clicking on the blue circular button in the Details column will present users with all available information on that specific server and allow modification of values.


Quick Access:
If the hostname of the server is known, all that is needed to access information on that server is to pass the hostname as a parameter in the URL address (i.e. http://atlas.genevatrading.com/#/asset?id=HOSTNAME).
For example, if a user wants to access information on the server named beast, all he/she would need to do is visit http://atlas.genevatrading.com/#/asset?id=beast


Details Page:
The details page presents users with all available information on a specific server.
The table header will be color coded based on server environment. Production environment will always be red while any other environment will be grey.
Any values that are in the form of an array or dictionary can be accessed by clicking the blue buttons that are labelled List or Dict.
Clicking this button will present the user with a drop down list containing the keys/values. To the right of this page, we have a section where we can modify some values. (See editable fields section)
 
 
Editable Fields:
In this section, the user is able to modify some values. For values that are strings, simply enter the desired value in the input field and click the blue Change button.
For values that are in an array, there is an Add and Remove button. To add a value to the array, select the desired value from the select box on the right and click Add.
To remove an item, select the desired value in the select box to the left and click Remove. This can be done multiple times until the desired values are added/removed.
Nothing that is added/removed is permanent until the user clicks the blue Save Changes button towards the bottom of the page.
Once this button is clicked, the user will be prompted with the final state of values, and has the option to confirm or cancel the change. Once confirmed, the changes are permanent.


Links:
The section on the top right labelled Links, contains relevant links for the specific server. For now, there are two links.
The button labelled Splunk will take you to the Splunk page for that server. The button to the right labelled View All Jobs will take users to a new page which contains salt jobs which recently ran on that server. (See jobs page section below)


Jobs Page:
The jobs page presents users with multiple cells, each representing a specific salt job that recently ran on a server. The cells are labelled by three values: name of job, time job began, and return code.
Clicking on a cell will expand the cell and present users with more information on the specific job. Cells are color coded - red cells are jobs that failed to complete; grey cells are jobs that completed successfully.
Clicking on the jid row will take users to a new page which contains a list of servers that ran the same job. (See runs page section below)


Runs Page:
The runs page presents users with information on a specific salt job which was ran across multiple servers. This page is similar to the jobs page in that it contains multiple expandable cells and the cells are color coded.
The cells are labelled by four values: server host name, name of job, time job began, and return code. Clicking on a cell will expand the cell and present users with more information on that specific job.
